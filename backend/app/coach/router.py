import logging
from datetime import date, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..db import get_session
from ..security import hash_secret
from . import planner
from .models import AlarmEvent, BehaviorEvent, Block, CoachUser, Goal, Preferences, ScheduleDay

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coach", tags=["coach"])


# ---------------------------------------------------------------- schemas


class OnboardIn(BaseModel):
    email: str
    password: str = Field(min_length=8)
    goal_title: str
    goal_why: str = ""
    target_date: Optional[date] = None
    wake_time: time
    sleep_time: time
    energy_pattern: str = ""
    meals_per_day: int = 3
    exercise_needs: str = ""
    current_habits: str = ""


class EventIn(BaseModel):
    coach_user_id: int
    block_id: Optional[int] = None
    kind: str  # ack | snooze | ignore | complete
    stage: Optional[str] = None  # t30 | t10, only meaningful for alarm outcomes
    payload: str = ""


# ---------------------------------------------------------------- helpers


def _user(session: Session, coach_user_id: int) -> CoachUser:
    user = session.get(CoachUser, coach_user_id)
    if not user:
        raise HTTPException(404, "coach user not found")
    return user


def _store_schedule(session: Session, coach_user_id: int, day: date, blocks: list[dict], source: str) -> ScheduleDay:
    existing = session.exec(
        select(ScheduleDay).where(
            ScheduleDay.coach_user_id == coach_user_id,
            ScheduleDay.day == day,
            ScheduleDay.is_current == True,  # noqa: E712
        )
    ).first()
    version = 1
    if existing:
        existing.is_current = False
        session.add(existing)
        version = existing.version + 1

    schedule_day = ScheduleDay(coach_user_id=coach_user_id, day=day, version=version, source=source)
    session.add(schedule_day)
    session.commit()
    session.refresh(schedule_day)

    for b in blocks:
        start_h, start_m = (int(p) for p in b["start_time"].split(":"))
        end_h, end_m = (int(p) for p in b["end_time"].split(":"))
        session.add(
            Block(
                schedule_day_id=schedule_day.id,
                kind=b["kind"],
                title=b["title"],
                start_time=time(hour=start_h, minute=start_m),
                end_time=time(hour=end_h % 24, minute=end_m),
            )
        )
    session.commit()
    return schedule_day


def _schedule_payload(session: Session, schedule_day: ScheduleDay) -> dict:
    blocks = session.exec(
        select(Block).where(Block.schedule_day_id == schedule_day.id).order_by(Block.start_time)
    ).all()
    return {
        "day": schedule_day.day,
        "version": schedule_day.version,
        "source": schedule_day.source,
        "blocks": [
            {
                "id": b.id,
                "kind": b.kind,
                "title": b.title,
                "start_time": b.start_time.strftime("%H:%M"),
                "end_time": b.end_time.strftime("%H:%M"),
                "status": b.status,
            }
            for b in blocks
        ],
    }


# ---------------------------------------------------------------- routes


@router.post("/onboard", status_code=201)
def onboard(payload: OnboardIn, session: Session = Depends(get_session)):
    if session.exec(select(CoachUser).where(CoachUser.email == payload.email)).first():
        raise HTTPException(409, "an account with that email already exists")

    user = CoachUser(email=payload.email, password_hash=hash_secret(payload.password))
    session.add(user)
    session.commit()
    session.refresh(user)

    session.add(
        Goal(coach_user_id=user.id, title=payload.goal_title, why=payload.goal_why, target_date=payload.target_date)
    )
    session.add(
        Preferences(
            coach_user_id=user.id,
            wake_time=payload.wake_time,
            sleep_time=payload.sleep_time,
            energy_pattern=payload.energy_pattern,
            meals_per_day=payload.meals_per_day,
            exercise_needs=payload.exercise_needs,
            current_habits=payload.current_habits,
        )
    )
    session.commit()

    blocks = planner.generate_schedule(
        goal_title=payload.goal_title,
        goal_why=payload.goal_why,
        wake_time=payload.wake_time,
        sleep_time=payload.sleep_time,
        energy_pattern=payload.energy_pattern,
        meals_per_day=payload.meals_per_day,
        exercise_needs=payload.exercise_needs,
        current_habits=payload.current_habits,
    )
    schedule_day = _store_schedule(session, user.id, date.today(), blocks, source="onboarding")

    return {"coach_user_id": user.id, "schedule": _schedule_payload(session, schedule_day)}


@router.get("/plan/today")
def plan_today(coach_user_id: int, session: Session = Depends(get_session)):
    _user(session, coach_user_id)
    schedule_day = session.exec(
        select(ScheduleDay).where(
            ScheduleDay.coach_user_id == coach_user_id,
            ScheduleDay.day == date.today(),
            ScheduleDay.is_current == True,  # noqa: E712
        )
    ).first()
    if not schedule_day:
        raise HTTPException(404, "no schedule generated for today yet")
    return _schedule_payload(session, schedule_day)


@router.post("/events", status_code=201)
def log_event(payload: EventIn, session: Session = Depends(get_session)):
    user = _user(session, payload.coach_user_id)

    block = None
    if payload.block_id is not None:
        block = session.get(Block, payload.block_id)
        if not block:
            raise HTTPException(404, "block not found")

    session.add(
        BehaviorEvent(
            coach_user_id=user.id,
            block_id=payload.block_id,
            kind=payload.kind,
            payload=payload.payload,
        )
    )

    if block is not None and payload.stage in ("t30", "t10") and payload.kind in ("ack", "snooze", "ignore"):
        session.add(
            AlarmEvent(
                block_id=block.id,
                coach_user_id=user.id,
                stage=payload.stage,
                outcome=payload.kind,
            )
        )

    if block is not None and payload.kind in ("ack", "ignore", "complete"):
        block.status = {"ack": "acked", "ignore": "ignored", "complete": "done"}[payload.kind]
        session.add(block)

    session.commit()

    if payload.kind == "ignore":
        # Fast-follow: synchronously replan the rest of the day here by
        # re-calling planner.generate_schedule with "block X was missed" as
        # context and storing a new ScheduleDay version. Logged, not built,
        # for this pass -- see the design doc's closed-loop section.
        log.info(
            "would replan rest of day for coach_user_id=%s after ignored block_id=%s",
            user.id,
            payload.block_id,
        )

    return {"ok": True}
