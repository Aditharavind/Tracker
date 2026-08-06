"""Fill the DB with fake history so you can see what the app looks like mid-run.

    python seed_demo.py          # adds demo users to the existing db
    python seed_demo.py --fresh  # wipes data.db first

Safe to skip entirely -- the app works fine starting from an empty database.
"""

import sys
from datetime import date, timedelta

from sqlmodel import Session, delete, select

from app.db import DB_PATH, engine, init_db
from app.models import CORE_TASKS, Completion, DayNote, Task, User

if "--fresh" in sys.argv and DB_PATH.exists():
    DB_PATH.unlink()
    print(f"removed {DB_PATH}")

init_db()
TODAY = date.today()

# name -> (color, days ago they started, days of the run they skipped)
PEOPLE = {
    "Adith": ("#e8734a", 24, {17, 16}),
    "Rahul": ("#4a9ee8", 24, {9}),
}

with Session(engine) as s:
    for name, (color, ago, skipped) in PEOPLE.items():
        existing = s.exec(select(User).where(User.name == name)).first()
        if existing:
            s.exec(delete(Completion).where(Completion.user_id == existing.id))
            s.exec(delete(DayNote).where(DayNote.user_id == existing.id))
            s.exec(delete(Task).where(Task.user_id == existing.id))
            s.delete(existing)
            s.commit()

        user = User(name=name, color=color, start_date=TODAY - timedelta(days=ago))
        s.add(user)
        s.commit()
        s.refresh(user)

        tasks = []
        for i, (title, emoji) in enumerate(CORE_TASKS):
            t = Task(user_id=user.id, title=title, emoji=emoji, is_core=True, sort=i)
            s.add(t)
            tasks.append(t)
        s.commit()

        for offset in range(ago, 0, -1):
            day = TODAY - timedelta(days=offset)
            hit = tasks if offset not in skipped else tasks[:4]
            for t in hit:
                s.add(Completion(user_id=user.id, task_id=t.id, day=day))
        s.commit()

        s.add(
            DayNote(
                user_id=user.id,
                day=TODAY,
                text="still owe the outdoor workout - going at 7pm",
            )
        )
        s.commit()
        print(f"seeded {name}: started {ago}d ago, skipped {sorted(skipped) or 'nothing'}")

print(f"\ndone -> {DB_PATH}")
