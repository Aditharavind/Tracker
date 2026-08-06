"""Data model for the AI execution coach subsystem.

Separate from the 75-Hard schema in ``app.models`` on purpose -- goals and
schedules aren't a fixed daily checklist, and coupling them to
``engine.py``'s streak semantics would fight the domain instead of fitting
it. Same "derive from raw events, don't store computed state" philosophy
though: ``BehaviorEvent`` is the append-only log everything else reads from.
"""

from datetime import date, datetime, time
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class CoachUser(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Goal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    coach_user_id: int = Field(foreign_key="coachuser.id", index=True)
    title: str
    why: str = ""
    target_date: Optional[date] = None
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Preferences(SQLModel, table=True):
    """One row per user -- the constraints the planner treats as fixed."""

    __table_args__ = (UniqueConstraint("coach_user_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    coach_user_id: int = Field(foreign_key="coachuser.id", index=True)
    wake_time: time
    sleep_time: time
    energy_pattern: str = ""  # free text, e.g. "sharpest 7-10am, dip after lunch"
    meals_per_day: int = 3
    exercise_needs: str = ""
    current_habits: str = ""
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ScheduleDay(SQLModel, table=True):
    """A generated plan for one calendar day. Regenerating never mutates a
    row in place -- it inserts a new version and flips ``is_current`` so a
    mid-day replan is auditable (see ``PlanVersion`` note in the design)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    coach_user_id: int = Field(foreign_key="coachuser.id", index=True)
    day: date = Field(index=True)
    version: int = 1
    is_current: bool = True
    source: str = "onboarding"  # onboarding | nightly | replan
    generated_at: datetime = Field(default_factory=datetime.utcnow)


BLOCK_KINDS = ("sleep", "exercise", "work", "meal", "misc", "buffer")


class Block(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    schedule_day_id: int = Field(foreign_key="scheduleday.id", index=True)
    kind: str  # one of BLOCK_KINDS
    title: str
    start_time: time
    end_time: time
    status: str = "pending"  # pending | acked | ignored | done


class AlarmEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    block_id: int = Field(foreign_key="block.id", index=True)
    coach_user_id: int = Field(foreign_key="coachuser.id", index=True)
    stage: str  # t30 | t10
    outcome: str  # ack | snooze | ignore
    occurred_at: datetime = Field(default_factory=datetime.utcnow)


class BehaviorEvent(SQLModel, table=True):
    """Normalized log everything above rolls into -- the raw material a
    future per-user procrastination-risk model would train on."""

    id: Optional[int] = Field(default=None, primary_key=True)
    coach_user_id: int = Field(foreign_key="coachuser.id", index=True)
    block_id: Optional[int] = Field(default=None, foreign_key="block.id", index=True)
    kind: str  # ack | snooze | ignore | complete | replan
    payload: str = ""  # small json blob, kept as text to avoid a JSON column dependency
    occurred_at: datetime = Field(default_factory=datetime.utcnow)


class WeeklyReport(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    coach_user_id: int = Field(foreign_key="coachuser.id", index=True)
    week_start: date = Field(index=True)
    week_end: date
    summary: str
    features_json: str = ""  # snapshot of the aggregates the summary was built from
    generated_at: datetime = Field(default_factory=datetime.utcnow)
