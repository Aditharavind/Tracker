from datetime import date, datetime, time
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    color: str = "#e8734a"
    start_date: date = Field(default_factory=date.today)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    pin_hash: Optional[str] = None
    wake_time: Optional[time] = None


class Task(SQLModel, table=True):
    """A habit checked off every day. Core tasks are what the 75 Hard rules
    require -- missing one kills the run. Extras earn XP but can't break a
    streak, so people can add personal goals without raising the stakes.
    ``locked`` tasks (currently just the alarm-gated wake-up exercise)
    can't be archived -- everything else, core or not, now can be."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    title: str
    emoji: str = "*"
    is_core: bool = True
    sort: int = 0
    archived: bool = False
    locked: bool = False
    reps_target: Optional[int] = None


class Completion(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "task_id", "day"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    task_id: int = Field(foreign_key="task.id", index=True)
    day: date = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DayNote(SQLModel, table=True):
    """Free-text "what's still pending / how did today go" log."""

    __table_args__ = (UniqueConstraint("user_id", "day"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    day: date = Field(index=True)
    text: str = ""
    updated_at: datetime = Field(default_factory=datetime.utcnow)


CORE_TASKS = [
    ("Two 45-min workouts", "\U0001f3cb"),
    ("One workout outdoors", "\U0001f333"),
    ("Follow the diet, no cheats", "\U0001f957"),
    ("No alcohol", "\U0001f6ab"),
    ("1 gallon of water", "\U0001f4a7"),
    ("Read 10 pages", "\U0001f4d6"),
    ("Progress photo", "\U0001f4f8"),
]
