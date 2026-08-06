"""Smoke tests for the streak brain. Run: python test_engine.py"""

from datetime import date, timedelta

from sqlmodel import Session, SQLModel, create_engine

from app import engine as brain
from app.models import CORE_TASKS, Completion, Task, User

eng = create_engine("sqlite://", connect_args={"check_same_thread": False})
SQLModel.metadata.create_all(eng)

TODAY = date(2026, 7, 29)


def fresh(session, name, start_offset):
    u = User(name=name, start_date=TODAY - timedelta(days=start_offset))
    session.add(u)
    session.commit()
    session.refresh(u)
    for i, (title, emoji) in enumerate(CORE_TASKS):
        session.add(Task(user_id=u.id, title=title, emoji=emoji, is_core=True, sort=i))
    session.commit()
    return u


def perfect(session, user, day):
    for t in brain.active_tasks(session, user.id):
        session.add(Completion(user_id=user.id, task_id=t.id, day=day))
    session.commit()


def partial(session, user, day, n):
    for t in brain.active_tasks(session, user.id)[:n]:
        session.add(Completion(user_id=user.id, task_id=t.id, day=day))
    session.commit()


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


with Session(eng) as s:
    print("\n[1] clean 10-day run, today untouched")
    u = fresh(s, "clean", 10)
    for i in range(10, 0, -1):
        perfect(s, u, TODAY - timedelta(days=i))
    p = brain.compute(s, u, TODAY)
    check("day_number", p.day_number, 11)
    check("streak", p.streak, 10)
    check("best_streak", p.best_streak, 10)
    check("resets", p.resets, 0)
    check("perfect_today", p.perfect_today, False)
    check("perfect_days_ever", p.perfect_days_ever, 10)

    print("\n[2] same run, today finished")
    perfect(s, u, TODAY)
    p = brain.compute(s, u, TODAY)
    check("streak", p.streak, 11)
    check("perfect_today", p.perfect_today, True)
    check("day_number", p.day_number, 11)

    print("\n[3] missed day 5 of 10 -> run restarts after it")
    u2 = fresh(s, "broken", 10)
    for i in range(10, 0, -1):
        day = TODAY - timedelta(days=i)
        if i == 6:
            partial(s, u2, day, 3)  # partial day still breaks it
        else:
            perfect(s, u2, day)
    p = brain.compute(s, u2, TODAY)
    check("run_start", p.run_start, TODAY - timedelta(days=5))
    check("day_number", p.day_number, 6)
    check("streak", p.streak, 5)
    check("best_streak", p.best_streak, 5)  # the 5-day run after the miss
    check("resets", p.resets, 1)

    print("\n[4] backfilling the missed day heals the run")
    day = TODAY - timedelta(days=6)
    for t in brain.active_tasks(s, u2.id)[3:]:
        s.add(Completion(user_id=u2.id, task_id=t.id, day=day))
    s.commit()
    p = brain.compute(s, u2, TODAY)
    check("streak", p.streak, 10)
    check("resets", p.resets, 0)

    print("\n[5] brand new user, nothing done")
    u3 = fresh(s, "newbie", 0)
    p = brain.compute(s, u3, TODAY)
    check("day_number", p.day_number, 1)
    check("streak", p.streak, 0)
    check("xp", p.xp, 0)
    check("level_name", p.level_name, "Rookie")
    check("next_badge", p.next_badge["day"], 3)
    check("calendar len", len(p.calendar), 75)
    check("calendar[0] status", p.calendar[0].status, "today")

    print("\n[6] xp + badge math at 7 days")
    u4 = fresh(s, "week", 7)
    for i in range(7, 0, -1):
        perfect(s, u4, TODAY - timedelta(days=i))
    p = brain.compute(s, u4, TODAY)
    # 7 days * 7 tasks * 10xp + 7 perfect * 40 + badges(3,7) bonus 15+35
    check("xp", p.xp, 7 * 7 * 10 + 7 * 40 + 15 + 35)
    check("earned badges", [b["name"] for b in p.badges if b["earned"]], ["Ignition", "One Week"])
    check("level_name", p.level_name, "Grinder")

    print("\n[7] long gap: many dead days count as one reset")
    u5 = fresh(s, "ghosted", 20)
    for i in range(20, 15, -1):
        perfect(s, u5, TODAY - timedelta(days=i))
    p = brain.compute(s, u5, TODAY)
    check("resets", p.resets, 1)
    check("streak", p.streak, 0)
    check("day_number", p.day_number, 1)
    check("best_streak", p.best_streak, 5)

print(f"\n{ok} passed, {fail} failed")
raise SystemExit(1 if fail else 0)
