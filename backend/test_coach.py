"""Smoke tests for the AI coach subsystem. Run: python test_coach.py

Follows the same plain-script pattern as test_engine.py rather than pulling
in pytest -- no new test dependency for a scaffold this size.
"""

import json
from datetime import time
from types import SimpleNamespace

from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from app.coach import models as coach_models  # noqa: F401 -- registers tables
from app.coach import planner
from app.coach import router as coach_router
from app.coach.models import BehaviorEvent, Block, CoachUser, ScheduleDay
from app.coach.router import EventIn, OnboardIn

eng = create_engine("sqlite://", connect_args={"check_same_thread": False})
SQLModel.metadata.create_all(eng)

ok = 0
fail = 0


def check(label, got, want):
    global ok, fail
    if got == want:
        ok += 1
        print(f"  pass  {label}: {got}")
    else:
        fail += 1
        print(f"  FAIL  {label}: got {got!r}, want {want!r}")


def check_raises(label, fn, exc_type):
    global ok, fail
    try:
        fn()
    except exc_type:
        ok += 1
        print(f"  pass  {label}: raised {exc_type.__name__}")
    else:
        fail += 1
        print(f"  FAIL  {label}: did not raise {exc_type.__name__}")


# ---------------------------------------------------------------- fakes


class FakeMessage:
    def __init__(self, text: str):
        self.content = [SimpleNamespace(type="text", text=text)]


class FakeMessages:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    def create(self, **kwargs):
        resp = self.responses[self.calls]
        self.calls += 1
        return resp


class FakeClient:
    def __init__(self, responses):
        self.messages = FakeMessages(responses)


VALID_BLOCKS_JSON = json.dumps(
    {
        "blocks": [
            {"kind": "work", "title": "Draft chapter 2", "start_time": "07:00", "end_time": "09:00"},
            {"kind": "meal", "title": "Breakfast", "start_time": "06:30", "end_time": "07:00"},
        ]
    }
)

OVERLAPPING_BLOCKS_JSON = json.dumps(
    {
        "blocks": [
            {"kind": "work", "title": "Draft chapter 2", "start_time": "07:00", "end_time": "09:00"},
            {"kind": "exercise", "title": "Run", "start_time": "08:00", "end_time": "08:30"},
        ]
    }
)


# ---------------------------------------------------------------- planner


print("\n[1] _validate_blocks sorts out-of-order input")
sorted_blocks = planner._validate_blocks(json.loads(VALID_BLOCKS_JSON)["blocks"])
check("first block after sort", sorted_blocks[0]["title"], "Breakfast")
check("second block after sort", sorted_blocks[1]["title"], "Draft chapter 2")

print("\n[2] _validate_blocks rejects overlaps")
check_raises(
    "overlap raises",
    lambda: planner._validate_blocks(json.loads(OVERLAPPING_BLOCKS_JSON)["blocks"]),
    planner.PlannerError,
)

print("\n[3] _validate_blocks rejects an empty schedule")
check_raises("empty raises", lambda: planner._validate_blocks([]), planner.PlannerError)

print("\n[4] generate_schedule retries once after an invalid first attempt")
fake = FakeClient([FakeMessage(OVERLAPPING_BLOCKS_JSON), FakeMessage(VALID_BLOCKS_JSON)])
blocks = planner.generate_schedule(
    goal_title="Write a novel",
    goal_why="",
    wake_time=time(6, 0),
    sleep_time=time(22, 0),
    energy_pattern="",
    meals_per_day=3,
    exercise_needs="",
    current_habits="",
    client=fake,
)
check("calls made", fake.messages.calls, 2)
check("blocks returned", len(blocks), 2)

print("\n[5] generate_schedule gives up after two bad attempts")
fake_bad = FakeClient([FakeMessage(OVERLAPPING_BLOCKS_JSON), FakeMessage(OVERLAPPING_BLOCKS_JSON)])
check_raises(
    "exhausted retries raises",
    lambda: planner.generate_schedule(
        goal_title="Write a novel",
        goal_why="",
        wake_time=time(6, 0),
        sleep_time=time(22, 0),
        energy_pattern="",
        meals_per_day=3,
        exercise_needs="",
        current_habits="",
        client=fake_bad,
    ),
    planner.PlannerError,
)
check("calls made before giving up", fake_bad.messages.calls, 2)


# ---------------------------------------------------------------- router


print("\n[6] onboarding creates a user, goal, preferences, and a stored schedule")
coach_router.planner.generate_schedule = lambda **kwargs: json.loads(VALID_BLOCKS_JSON)["blocks"]

with Session(eng) as s:
    payload = OnboardIn(
        email="ada@example.com",
        password="correct horse battery staple",
        goal_title="Write a novel",
        goal_why="Always wanted to finish one",
        wake_time=time(6, 0),
        sleep_time=time(22, 0),
        energy_pattern="sharpest in the morning",
        meals_per_day=3,
        exercise_needs="30 min daily",
        current_habits="none yet",
    )
    result = coach_router.onboard(payload, session=s)
    coach_user_id = result["coach_user_id"]

    check("user created", s.get(CoachUser, coach_user_id).email, "ada@example.com")
    check("schedule day count", len(result["schedule"]["blocks"]), 2)

    schedule_day = s.exec(
        select(ScheduleDay).where(ScheduleDay.coach_user_id == coach_user_id)
    ).first()
    check("schedule stored as current", schedule_day.is_current, True)

print("\n[7] duplicate email onboarding is rejected")
with Session(eng) as s:
    check_raises(
        "duplicate email raises HTTPException",
        lambda: coach_router.onboard(payload, session=s),
        HTTPException,
    )

print("\n[8] an ignored block logs a BehaviorEvent and flips block status")
with Session(eng) as s:
    block = s.exec(select(Block)).first()
    coach_router.log_event(
        EventIn(coach_user_id=coach_user_id, block_id=block.id, kind="ignore", stage="t10"),
        session=s,
    )
    s.refresh(block)
    check("block status flipped", block.status, "ignored")
    events = s.exec(
        select(BehaviorEvent).where(BehaviorEvent.coach_user_id == coach_user_id)
    ).all()
    check("behavior event logged", any(e.kind == "ignore" for e in events), True)


print(f"\n{ok} passed, {fail} failed")
raise SystemExit(1 if fail else 0)
