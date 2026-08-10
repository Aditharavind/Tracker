"""Local, closed-loop "why am I missing this" insight.

Reasons over one user's own history via a small model running through
Ollama on 127.0.0.1 -- never a cloud call, unlike coach/planner.py. See the
plan for the hardware reality that picked the model default: this box has
~6GB RAM total, and llama3.2:3b thrashed swap badly (3.5min for 8 tokens).
qwen2.5:0.5b fits comfortably and, while a weaker reasoner, is fast enough
for an on-demand click when paired with the fingerprint cache below.
"""

import hashlib
import os
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

import httpx
from sqlmodel import Session, select

from . import engine as brain
from .models import DayNote, Insight, User

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.getenv("INSIGHT_MODEL", "qwen2.5:0.5b")
LOOKBACK_DAYS = 30

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

NO_HISTORY_TEXT = "Not enough history yet -- check back after a few days of tracking."

PROMPT_TEMPLATE = """You are a terse, blunt habit coach. Given ONLY the user's own historical data below, explain in 2-4 sentences why they're likely missing the tasks listed as pending today, and give one concrete, specific suggestion. Do not moralize. Do not invent facts not in the data. If the data doesn't clearly explain a pattern, say so plainly instead of guessing.

{context}"""


class OllamaUnavailable(Exception):
    """Ollama isn't reachable, or the configured model isn't pulled."""


def _build_context(session: Session, user: User, today: Optional[date] = None) -> Optional[str]:
    today = today or date.today()
    progress = brain.compute(session, user, today)
    tasks = brain.active_tasks(session, user.id)
    done_by_day = brain.completions_by_day(session, user.id)

    lookback_start = max(progress.run_start, today - timedelta(days=LOOKBACK_DAYS))
    miss_counts: dict[int, int] = defaultdict(int)
    miss_by_weekday: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    opportunities = 0

    d = lookback_start
    while d < today:
        opportunities += 1
        done_ids = done_by_day.get(d, set())
        for t in tasks:
            if t.id not in done_ids:
                miss_counts[t.id] += 1
                miss_by_weekday[t.id][d.weekday()] += 1
        d += timedelta(days=1)

    if opportunities == 0 or not any(miss_counts.values()):
        return None

    task_by_id = {t.id: t for t in tasks}
    miss_lines = []
    for task_id, count in sorted(miss_counts.items(), key=lambda kv: -kv[1]):
        if count == 0:
            continue
        worst_wd, wd_count = max(miss_by_weekday[task_id].items(), key=lambda kv: kv[1])
        title = task_by_id[task_id].title
        miss_lines.append(f"- \"{title}\": missed {count} of {opportunities} days, mostly {WEEKDAYS[worst_wd]}s ({wd_count}x)")

    notes = session.exec(
        select(DayNote)
        .where(DayNote.user_id == user.id, DayNote.text != "")
        .order_by(DayNote.day.desc())
        .limit(10)
    ).all()
    note_lines = [f"- {n.day}: {n.text}" for n in notes]

    pending_today = [t.title for t in tasks if t.id not in done_by_day.get(today, set())]

    return "\n".join(
        [
            f"User: {user.name}, day {progress.day_number} of their current 75-day run (started {progress.run_start}).",
            "",
            f"Miss pattern (last {opportunities} day(s)):",
            *(miss_lines or ["- no repeated misses"]),
            "",
            "Recent notes in their own words:",
            *(note_lines or ["- no notes logged"]),
            "",
            "Still pending today: " + (", ".join(pending_today) if pending_today else "nothing"),
        ]
    )


def _fingerprint(context: str) -> str:
    return hashlib.sha256(context.encode()).hexdigest()


def call_ollama(context: str) -> str:
    prompt = PROMPT_TEMPLATE.format(context=context)
    try:
        resp = httpx.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": MODEL, "prompt": prompt, "stream": False},
            timeout=httpx.Timeout(180.0, connect=5.0),
        )
    except httpx.ConnectError:
        raise OllamaUnavailable("local model unavailable -- is Ollama running?")
    except httpx.TimeoutException:
        raise OllamaUnavailable("local model timed out -- it may be overloaded, try again")

    if resp.status_code == 404:
        raise OllamaUnavailable(f"model '{MODEL}' isn't pulled yet -- run: ollama pull {MODEL}")
    resp.raise_for_status()
    return resp.json()["response"].strip()


def generate_insight(session: Session, user: User, *, force: bool = False) -> dict:
    context = _build_context(session, user)
    cached = session.exec(select(Insight).where(Insight.user_id == user.id)).first()

    if context is None:
        text = NO_HISTORY_TEXT
        if cached is None or cached.text != text:
            cached = cached or Insight(user_id=user.id, text=text, fingerprint="none")
            cached.text = text
            cached.fingerprint = "none"
            session.add(cached)
            session.commit()
        return {"text": text, "generated_at": cached.generated_at, "cached": False}

    fingerprint = _fingerprint(context)
    if cached and cached.fingerprint == fingerprint and not force:
        return {"text": cached.text, "generated_at": cached.generated_at, "cached": True}

    text = call_ollama(context)

    if cached:
        cached.text = text
        cached.fingerprint = fingerprint
    else:
        cached = Insight(user_id=user.id, text=text, fingerprint=fingerprint)
    session.add(cached)
    session.commit()
    session.refresh(cached)
    return {"text": text, "generated_at": cached.generated_at, "cached": False}
