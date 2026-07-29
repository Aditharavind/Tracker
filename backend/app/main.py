from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from . import engine as brain
from .db import get_session, init_db
from .models import CORE_TASKS, Completion, DayNote, Task, User

app = FastAPI(title="75 Hard")

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


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    emoji: str = "*"
    is_core: bool = False


class ToggleIn(BaseModel):
    task_id: int
    day: date
    done: bool


class NoteIn(BaseModel):
    day: date
    text: str = ""


# ---------------------------------------------------------------- helpers


def _user(session: Session, user_id: int) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "user not found")
    return user


def _progress(session: Session, user: User) -> dict:
    return asdict(brain.compute(session, user))


# ---------------------------------------------------------------- routes


@app.get("/api/users")
def list_users(session: Session = Depends(get_session)):
    users = session.exec(select(User).order_by(User.id)).all()
    return [{"id": u.id, "name": u.name, "color": u.color, "start_date": u.start_date} for u in users]


@app.post("/api/users", status_code=201)
def create_user(payload: UserIn, session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.name == payload.name)).first():
        raise HTTPException(409, "that name is taken")
    user = User(
        name=payload.name,
        color=payload.color,
        start_date=payload.start_date or date.today(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    for i, (title, emoji) in enumerate(CORE_TASKS):
        session.add(Task(user_id=user.id, title=title, emoji=emoji, is_core=True, sort=i))
    session.commit()
    return {"id": user.id, "name": user.name, "color": user.color, "start_date": user.start_date}


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
def archive_task(user_id: int, task_id: int, session: Session = Depends(get_session)):
    user = _user(session, user_id)
    task = session.get(Task, task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(404, "task not found")
    task.archived = True
    session.add(task)
    session.commit()


@app.post("/api/users/{user_id}/restart")
def restart(user_id: int, session: Session = Depends(get_session)):
    """Manual "I blew it, start over from today" button."""
    user = _user(session, user_id)
    user.start_date = date.today()
    session.add(user)
    session.commit()
    return _progress(session, user)


# Serve the built frontend when it exists, so `npm run build` + uvicorn is
# enough to run the whole thing from one process.
_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
