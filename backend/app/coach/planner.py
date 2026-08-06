"""LLM orchestration for the coach: turns a goal + constraints into a day's
schedule. Structured outputs (``output_config.format``) do the schema
enforcement; this module only has to validate the *semantics* a JSON schema
can't express -- blocks covering the day in order, no overlaps.
"""

import json
from datetime import date, datetime, time, timedelta
from typing import Optional

import anthropic

from .models import BLOCK_KINDS

MODEL = "claude-opus-5"

SCHEDULE_SCHEMA = {
    "type": "object",
    "properties": {
        "blocks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": list(BLOCK_KINDS)},
                    "title": {"type": "string"},
                    "start_time": {"type": "string", "description": "24h HH:MM"},
                    "end_time": {"type": "string", "description": "24h HH:MM"},
                },
                "required": ["kind", "title", "start_time", "end_time"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["blocks"],
    "additionalProperties": False,
}


class PlannerError(Exception):
    """The model couldn't produce a schedule that passes validation."""


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic()


def _prompt(
    goal_title: str,
    goal_why: str,
    wake_time: time,
    sleep_time: time,
    energy_pattern: str,
    meals_per_day: int,
    exercise_needs: str,
    current_habits: str,
    context: str = "",
) -> str:
    return f"""You are an execution coach building one day's schedule for someone working toward a goal. Work backward from the goal into concrete blocks.

Goal: {goal_title}
Why it matters to them: {goal_why or "not specified"}

Fixed constraints:
- Wake time: {wake_time.strftime('%H:%M')}
- Sleep time: {sleep_time.strftime('%H:%M')}
- Energy pattern: {energy_pattern or "not specified"}
- Meals per day: {meals_per_day}
- Exercise needs: {exercise_needs or "not specified"}
- Current habits: {current_habits or "not specified"}
{("Additional context: " + context) if context else ""}

Produce a full day of blocks from wake time to sleep time (inclusive of a sleep block for the overnight hours). Every block must be one of: {', '.join(BLOCK_KINDS)}. Blocks must be contiguous and non-overlapping, in chronological order, covering the whole day. Place high-effort work blocks during the stated energy peaks. Include buffer blocks so the day doesn't overpack. Titles should be specific to the goal, not generic ("Deep work: draft chapter 2" not "Work block")."""


def _parse_hm(value: str, day: date) -> datetime:
    hour, minute = (int(p) for p in value.split(":"))
    return datetime.combine(day, time(hour=hour, minute=minute))


def _validate_blocks(raw_blocks: list[dict]) -> list[dict]:
    if not raw_blocks:
        raise PlannerError("model returned no blocks")

    anchor = date.today()
    parsed = []
    for b in raw_blocks:
        start = _parse_hm(b["start_time"], anchor)
        end = _parse_hm(b["end_time"], anchor)
        if end <= start:
            end += timedelta(days=1)  # overnight block (e.g. sleep)
        parsed.append({**b, "_start": start, "_end": end})

    parsed.sort(key=lambda b: b["_start"])
    for prev, cur in zip(parsed, parsed[1:]):
        if cur["_start"] < prev["_end"]:
            raise PlannerError(
                f"overlapping blocks: '{prev['title']}' ends after '{cur['title']}' starts"
            )

    return [
        {"kind": b["kind"], "title": b["title"], "start_time": b["start_time"], "end_time": b["end_time"]}
        for b in parsed
    ]


def generate_schedule(
    *,
    goal_title: str,
    goal_why: str,
    wake_time: time,
    sleep_time: time,
    energy_pattern: str,
    meals_per_day: int,
    exercise_needs: str,
    current_habits: str,
    context: str = "",
    client: Optional[anthropic.Anthropic] = None,
) -> list[dict]:
    """Calls Claude, validates the result, and retries once with the
    validation error fed back in if the first attempt doesn't hold up."""

    client = client or _client()
    prompt = _prompt(
        goal_title, goal_why, wake_time, sleep_time, energy_pattern,
        meals_per_day, exercise_needs, current_habits, context,
    )

    for attempt in range(2):
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            output_config={"format": {"type": "json_schema", "schema": SCHEDULE_SCHEMA}},
            messages=[{"role": "user", "content": prompt}],
        )
        text = next(b.text for b in response.content if b.type == "text")
        data = json.loads(text)
        try:
            return _validate_blocks(data["blocks"])
        except PlannerError as e:
            if attempt == 1:
                raise
            prompt += f"\n\nYour previous attempt was invalid: {e}. Fix it and return a corrected full day."

    raise PlannerError("unreachable")
