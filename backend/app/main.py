from dataclasses import asdict
from datetime import date, time
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from . import engine as brain
from .coach import models as coach_models  # noqa: F401 -- registers coach tables with SQLModel.metadata
from .coach.router import router as coach_router
from .db import get_session, init_db
from .models import CORE_TASKS, Completion, DayNote, Task, User
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


# ---------------------------------------------------------------- helpers


def _user(session: Session, user_id: int) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "user not found")
    return user


def _progress(session: Session, user: User) -> dict:
    return asdict(brain.compute(session, user))


def _require_pin(user: User, pin: Optional[str]) -> None:
    """Users created before PIN support has no pin_hash -- unprotected,
    same as today, until they set one via PUT /users/{id}/pin."""
    if user.pin_hash and not verify_secret(pin or "", user.pin_hash):
        raise HTTPException(403, "wrong PIN")


# ---------------------------------------------------------------- routes


def _user_out(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "color": u.color,
        "start_date": u.start_date,
        "wake_time": u.wake_time,
        "has_pin": u.pin_hash is not None,
    }


@app.get("/api/users")
def list_users(session: Session = Depends(get_session)):
    users = session.exec(select(User).order_by(User.id)).all()
    return [_user_out(u) for u in users]


@app.post("/api/users", status_code=201)
def create_user(payload: UserIn, session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.name == payload.name)).first():
        raise HTTPException(409, "that name is taken")
    user = User(
        name=payload.name,
        color=payload.color,
        start_date=payload.start_date or date.today(),
        pin_hash=hash_secret(payload.pin),
        wake_time=payload.wake_time,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    for i, (title, emoji) in enumerate(CORE_TASKS):
        session.add(Task(user_id=user.id, title=title, emoji=emoji, is_core=True, sort=i))
    if payload.wake_time is not None:
        session.add(
            Task(
                user_id=user.id,
                title=f"{payload.reps_target} reps to wake up",
                emoji="⏰",
                is_core=True,
                locked=True,
                reps_target=payload.reps_target,
                sort=len(CORE_TASKS),
            )
        )
    session.commit()
    return _user_out(user)


@app.get("/api/board")
def board(session: Session = Depends(get_session)):
    """Everything both players need for the head-to-head view."""
    users = session.exec(select(User).order_by(User.id)).all()
    return [_progress(session, u) for u in users]


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
    return _user_out(user)


# Serve the built frontend when it exists, so `npm run build` + uvicorn is
# enough to run the whole thing from one process.
_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
