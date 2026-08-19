from datetime import date, datetime, time
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class Group(SQLModel, table=True):
    """An isolated board -- users only ever see/rank against the rest of
    their own group. Every user belongs to exactly one, created for them
    automatically the moment they're the first member (see main.create_user)."""

    __tablename__ = "groups"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = "My board"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # Unguessable link anyone can use to join this group as a new member --
    # distinct from a user's individual share_token, which stays read-only.
    invite_token: Optional[str] = Field(default=None, unique=True, index=True)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    color: str = "#e8734a"
    start_date: date = Field(default_factory=date.today)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    pin_hash: Optional[str] = None
    wake_time: Optional[time] = None
    group_id: Optional[int] = Field(default=None, foreign_key="groups.id", index=True)
    # Unguessable, PIN-free read-only link -- deliberately separate from
    # group membership: sharing your progress with someone doesn't make
    # them a group member who could ever be prompted to edit anything.
    share_token: Optional[str] = Field(default=None, unique=True, index=True)
    # Convenience only, never an auth mechanism: lets a browser with no
    # saved local user get its tile pre-selected on a later visit from the
    # same IP instead of landing on the onboarding screen. PIN is still
    # required for every mutation regardless of IP -- see GET
    # /api/session/suggest and _require_pin in main.py.
    last_ip: Optional[str] = None
    last_seen_at: Optional[datetime] = None


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


class Insight(SQLModel, table=True):
    """One cached local-model explanation per user. ``fingerprint`` is a hash
    of the data that produced ``text`` -- a cheap way to know the cached
    answer is stale (new completions/notes since) without re-running the
    model on every click."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)
    text: str
    fingerprint: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)


CORE_TASKS = [
    ("Two 45-min workouts", "\U0001f3cb"),
    ("One workout outdoors", "\U0001f333"),
    ("Follow the diet, no cheats", "\U0001f957"),
    ("No alcohol", "\U0001f6ab"),
    ("1 gallon of water", "\U0001f4a7"),
    ("Read 10 pages", "\U0001f4d6"),
    ("Progress photo", "\U0001f4f8"),
]
