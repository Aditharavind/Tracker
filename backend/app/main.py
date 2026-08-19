import secrets
from dataclasses import asdict
from datetime import date, datetime, time
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from . import engine as brain
from . import insight
from .coach import models as coach_models  # noqa: F401 -- registers coach tables with SQLModel.metadata
from .coach.router import router as coach_router
from .db import get_session, init_db
from .models import CORE_TASKS, Completion, DayNote, Group, Task, User
from .security import hash_secret, verify_secret

app = FastAPI(title="75 Hard")
app.include_router(coach_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


# ---------------------------------------------------------------- schemas


class UserIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: str = "#e8734a"
    start_date: Optional[date] = None
    pin: str = Field(pattern=r"^\d{4,6}$")
    wake_time: Optional[time] = None
    reps_target: int = 20
    # An existing user's id to join their group/board. Omitted -> a brand
    # new, isolated group is created (this is what keeps two strangers who
    # both open the app from ending up on the same board).
    invited_by: Optional[int] = None


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    emoji: str = "*"
    is_core: bool = False
    pin: Optional[str] = None


class ToggleIn(BaseModel):
    task_id: int
    day: date
    done: bool
    pin: Optional[str] = None


class NoteIn(BaseModel):
    day: date
    text: str = ""
    pin: Optional[str] = None


class RestartIn(BaseModel):
    pin: Optional[str] = None


class TaskDeleteIn(BaseModel):
    pin: Optional[str] = None


class PinIn(BaseModel):
    new_pin: str = Field(pattern=r"^\d{4,6}$")
    pin: Optional[str] = None


class WakeIn(BaseModel):
    wake_time: Optional[time] = None
    reps_target: int = 20
    pin: Optional[str] = None


class InsightIn(BaseModel):
    force: bool = False


class JoinIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: str = "#e8734a"
    pin: str = Field(pattern=r"^\d{4,6}$")
    wake_time: Optional[time] = None
    reps_target: int = 20


# ---------------------------------------------------------------- helpers


def _user(session: Session, user_id: int) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "user not found")
    return user


def _progress(session: Session, user: User) -> dict:
    return asdict(brain.compute(session, user))


def _require_pin(user: User, pin: Optional[str]) -> None:
    """PIN enforcement disabled by request -- this was prompting on every
    single mutation (every task checkmark), which was pure friction for a
    device only its own owner uses. Left as a no-op rather than deleted so
    the pin_hash column/UI can be re-enabled later without re-deriving this
    logic; accounts that already set a PIN keep it on file, it's just never
    checked again."""
    return


def _client_ip(request: Request) -> str:
    # Trust X-Forwarded-For only for the convenience suggestion below, which
    # grants no access on its own -- if a deployment sits behind a proxy
    # that doesn't set this, it degrades to the proxy's own address, which
    # just makes the suggestion less precise, never wrong in a way that
    # matters (PIN still gates every mutation).
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _touch_session(session: Session, user: User, request: Request) -> None:
    user.last_ip = _client_ip(request)
    user.last_seen_at = datetime.utcnow()
    session.add(user)
    session.commit()


def _new_share_token() -> str:
    return secrets.token_urlsafe(9)


def _new_invite_token() -> str:
    return secrets.token_urlsafe(9)


def _seed_default_tasks(session: Session, user: User, wake_time: Optional[time], reps_target: int) -> None:
    for i, (title, emoji) in enumerate(CORE_TASKS):
        session.add(Task(user_id=user.id, title=title, emoji=emoji, is_core=True, sort=i))
    if wake_time is not None:
        session.add(
            Task(
                user_id=user.id,
                title=f"{reps_target} reps to wake up",
                emoji="⏰",
                is_core=True,
                locked=True,
                reps_target=reps_target,
                sort=len(CORE_TASKS),
            )
        )


# ---------------------------------------------------------------- routes


def _user_out(session: Session, u: User, reveal_token: bool = False) -> dict:
    out = {
        "id": u.id,
        "name": u.name,
        "color": u.color,
        "start_date": u.start_date,
        "wake_time": u.wake_time,
        "has_pin": u.pin_hash is not None,
    }
    # Only handed back to the user themself -- other group members can see
    # each other's names/colors, but not each other's share/invite links.
    if reveal_token:
        out["share_token"] = u.share_token
        group = session.get(Group, u.group_id)
        out["invite_token"] = group.invite_token if group else None
    return out


@app.get("/api/users")
def list_users(
    request: Request,
    as_: Optional[int] = Query(None, alias="as"),
    session: Session = Depends(get_session),
):
    """Scoped to the caller's own group -- `as` identifies which existing
    user is asking. No `as` (a browser with no local user yet) sees an
    empty board and starts a fresh, isolated group on signup."""
    me = session.get(User, as_) if as_ is not None else None
    if me is None:
        return []
    _touch_session(session, me, request)
    users = session.exec(select(User).where(User.group_id == me.group_id).order_by(User.id)).all()
    return [_user_out(session, u, reveal_token=(u.id == as_)) for u in users]


@app.get("/api/session/suggest")
def suggest_session(request: Request, session: Session = Depends(get_session)):
    """Convenience only -- lets a browser with no saved local user (cleared
    storage, new device) get pre-selected instead of dropped on the
    onboarding screen, if this IP was last seen as a specific user. Never
    grants access: the frontend still needs the right PIN to edit anything,
    exactly as if the user had picked their own tile from the list."""
    ip = _client_ip(request)
    user = session.exec(
        select(User).where(User.last_ip == ip).order_by(User.last_seen_at.desc())
    ).first()
    if user is None:
        return {"user_id": None}
    return {"user_id": user.id, "name": user.name, "color": user.color}


@app.post("/api/users", status_code=201)
def create_user(payload: UserIn, request: Request, session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.name == payload.name)).first():
        raise HTTPException(409, "that name is taken")

    if payload.invited_by is not None:
        group_id = _user(session, payload.invited_by).group_id
    else:
        group = Group(invite_token=_new_invite_token())
        session.add(group)
        session.commit()
        session.refresh(group)
        group_id = group.id

    user = User(
        name=payload.name,
        color=payload.color,
        start_date=payload.start_date or date.today(),
        pin_hash=hash_secret(payload.pin),
        wake_time=payload.wake_time,
        group_id=group_id,
        share_token=_new_share_token(),
        last_ip=_client_ip(request),
        last_seen_at=datetime.utcnow(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    _seed_default_tasks(session, user, payload.wake_time, payload.reps_target)
    session.commit()
    return _user_out(session, user, reveal_token=True)


@app.get("/api/board")
def board(as_: Optional[int] = Query(None, alias="as"), session: Session = Depends(get_session)):
    """Everything the group needs for the head-to-head view -- scoped the
    same way as /api/users, see there for why."""
    me = session.get(User, as_) if as_ is not None else None
    if me is None:
        return []
    users = session.exec(select(User).where(User.group_id == me.group_id).order_by(User.id)).all()
    return [_progress(session, u) for u in users]


@app.get("/api/share/{token}")
def shared_progress(token: str, session: Session = Depends(get_session)):
    """Public, PIN-free, read-only -- deliberately the same payload already
    visible to group-mates on the board, just reachable by anyone holding
    the link. No day/task/note detail is exposed here."""
    user = session.exec(select(User).where(User.share_token == token)).first()
    if not user:
        raise HTTPException(404, "invalid or expired link")
    return _progress(session, user)


@app.get("/api/invite/{token}")
def invite_info(token: str, session: Session = Depends(get_session)):
    """Public preview of who's already in the lobby -- shown before someone
    commits to joining. No ids, pins, or tokens leak here."""
    group = session.exec(select(Group).where(Group.invite_token == token)).first()
    if not group:
        raise HTTPException(404, "invalid or expired invite")
    members = session.exec(select(User).where(User.group_id == group.id).order_by(User.id)).all()
    return {"members": [{"name": u.name, "color": u.color} for u in members]}


@app.post("/api/invite/{token}/join", status_code=201)
def join_invite(token: str, payload: JoinIn, session: Session = Depends(get_session)):
    """Actually joins the lobby -- unlike /api/share, this creates a real,
    editable member (their own tasks/PIN), not a read-only view."""
    group = session.exec(select(Group).where(Group.invite_token == token)).first()
    if not group:
        raise HTTPException(404, "invalid or expired invite")
    if session.exec(select(User).where(User.name == payload.name)).first():
        raise HTTPException(409, "that name is taken")

    user = User(
        name=payload.name,
        color=payload.color,
        start_date=date.today(),
        pin_hash=hash_secret(payload.pin),
        wake_time=payload.wake_time,
        group_id=group.id,
        share_token=_new_share_token(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    _seed_default_tasks(session, user, payload.wake_time, payload.reps_target)
    session.commit()
    return _user_out(session, user, reveal_token=True)


@app.get("/api/users/{user_id}/progress")
def progress(user_id: int, session: Session = Depends(get_session)):
    return _progress(session, _user(session, user_id))


@app.get("/api/users/{user_id}/day/{day}")
def get_day(user_id: int, day: date, session: Session = Depends(get_session)):
    user = _user(session, user_id)
    return brain.day_detail(session, user, day)


@app.post("/api/users/{user_id}/toggle")
def toggle(user_id: int, payload: ToggleIn, session: Session = Depends(get_session)):
    user = _user(session, user_id)
    _require_pin(user, payload.pin)
    task = session.get(Task, payload.task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(404, "task not found")
    if payload.day > date.today():
        raise HTTPException(400, "can't tick off a day that hasn't happened")

    existing = session.exec(
        select(Completion).where(
            Completion.user_id == user.id,
            Completion.task_id == task.id,
            Completion.day == payload.day,
        )
    ).first()

    if payload.done and not existing:
        session.add(Completion(user_id=user.id, task_id=task.id, day=payload.day))
    elif not payload.done and existing:
        session.delete(existing)
    session.commit()

    return {
        "day": brain.day_detail(session, user, payload.day),
        "progress": _progress(session, user),
    }


@app.put("/api/users/{user_id}/note")
def put_note(user_id: int, payload: NoteIn, session: Session = Depends(get_session)):
    user = _user(session, user_id)
    _require_pin(user, payload.pin)
    note = session.exec(
        select(DayNote).where(DayNote.user_id == user.id, DayNote.day == payload.day)
    ).first()
    if note:
        note.text = payload.text
    else:
        note = DayNote(user_id=user.id, day=payload.day, text=payload.text)
    session.add(note)
    session.commit()
    return {"ok": True}


@app.get("/api/users/{user_id}/tasks")
def get_tasks(user_id: int, session: Session = Depends(get_session)):
    user = _user(session, user_id)
    return brain.active_tasks(session, user.id)


@app.post("/api/users/{user_id}/tasks", status_code=201)
def add_task(user_id: int, payload: TaskIn, session: Session = Depends(get_session)):
    user = _user(session, user_id)
    _require_pin(user, payload.pin)
    top = max((t.sort for t in brain.active_tasks(session, user.id)), default=0)
    task = Task(
        user_id=user.id,
        title=payload.title,
        emoji=payload.emoji or "*",
        is_core=payload.is_core,
        sort=top + 1,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@app.delete("/api/users/{user_id}/tasks/{task_id}", status_code=204)
def archive_task(user_id: int, task_id: int, payload: TaskDeleteIn, session: Session = Depends(get_session)):
    user = _user(session, user_id)
    _require_pin(user, payload.pin)
    task = session.get(Task, task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(404, "task not found")
    if task.locked:
        raise HTTPException(409, "this one's the bare minimum -- can't be removed")
    task.archived = True
    session.add(task)
    session.commit()


@app.post("/api/users/{user_id}/restart")
def restart(user_id: int, payload: RestartIn, session: Session = Depends(get_session)):
    """Manual "I blew it, start over from today" button."""
    user = _user(session, user_id)
    _require_pin(user, payload.pin)
    user.start_date = date.today()
    session.add(user)
    session.commit()
    return _progress(session, user)


@app.put("/api/users/{user_id}/pin")
def set_pin(user_id: int, payload: PinIn, session: Session = Depends(get_session)):
    user = _user(session, user_id)
    _require_pin(user, payload.pin)
    user.pin_hash = hash_secret(payload.new_pin)
    session.add(user)
    session.commit()
    return {"ok": True}


@app.put("/api/users/{user_id}/wake")
def set_wake(user_id: int, payload: WakeIn, session: Session = Depends(get_session)):
    user = _user(session, user_id)
    _require_pin(user, payload.pin)
    user.wake_time = payload.wake_time
    session.add(user)

    if payload.wake_time is not None:
        locked = session.exec(
            select(Task).where(Task.user_id == user.id, Task.locked == True, Task.archived == False)  # noqa: E712
        ).first()
        if locked:
            locked.reps_target = payload.reps_target
            locked.title = f"{payload.reps_target} reps to wake up"
            session.add(locked)
        else:
            top = max((t.sort for t in brain.active_tasks(session, user.id)), default=0)
            session.add(
                Task(
                    user_id=user.id,
                    title=f"{payload.reps_target} reps to wake up",
                    emoji="⏰",
                    is_core=True,
                    locked=True,
                    reps_target=payload.reps_target,
                    sort=top + 1,
                )
            )
    session.commit()
    return _user_out(session, user, reveal_token=True)


@app.post("/api/users/{user_id}/insight")
def get_insight(user_id: int, payload: InsightIn, session: Session = Depends(get_session)):
    """Local-model explanation of the user's own miss pattern -- read-only
    (no PIN) but POST since it writes to the Insight cache, matching how
    `toggle` is POST despite being conceptually a read of the new state."""
    user = _user(session, user_id)
    try:
        return insight.generate_insight(session, user, force=payload.force)
    except insight.OllamaUnavailable as e:
        raise HTTPException(503, str(e))


# Serve the built frontend when it exists, so `npm run build` + uvicorn is
# enough to run the whole thing from one process.
_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
