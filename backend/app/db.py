import os
from pathlib import Path

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

DB_PATH = Path(os.getenv("SEVENTYFIVE_DB", Path(__file__).resolve().parent.parent / "data.db"))
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)

# create_all only adds missing tables, not missing columns on existing ones,
# and this project has no migration tool -- so new columns get added here by
# hand. Safe to run every startup: each entry is skipped once it exists.
_NEW_COLUMNS = [
    ("user", "pin_hash", "TEXT"),
    ("user", "wake_time", "TEXT"),
    ("task", "locked", "BOOLEAN DEFAULT 0"),
    ("task", "reps_target", "INTEGER"),
]


def _migrate(conn) -> None:
    for table, column, coltype in _NEW_COLUMNS:
        existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
        if column not in existing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}"))


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        _migrate(conn)


def get_session():
    with Session(engine) as session:
        yield session
