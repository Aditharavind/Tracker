import os
import secrets
from datetime import datetime
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
    ("user", "group_id", "INTEGER"),
    ("user", "share_token", "TEXT"),
    ("groups", "invite_token", "TEXT"),
    ("user", "last_ip", "TEXT"),
    ("user", "last_seen_at", "TEXT"),
]


def _migrate(conn) -> None:
    for table, column, coltype in _NEW_COLUMNS:
        existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
        if column not in existing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}"))


def _backfill_groups(conn) -> None:
    """Column-add alone leaves pre-existing rows with NULL group_id /
    share_token. Give every orphaned user a single shared group (preserving
    today's one-board-for-everyone behaviour exactly) and a real token."""
    orphan_ids = [row[0] for row in conn.execute(text("SELECT id FROM user WHERE group_id IS NULL"))]
    if orphan_ids:
        conn.execute(
            text("INSERT INTO groups (name, created_at) VALUES ('My board', :now)"),
            {"now": datetime.utcnow().isoformat()},
        )
        group_id = conn.execute(text("SELECT last_insert_rowid()")).scalar()
        conn.execute(
            text(f"UPDATE user SET group_id = :gid WHERE id IN ({','.join(str(i) for i in orphan_ids)})"),
            {"gid": group_id},
        )
    for (uid,) in conn.execute(text("SELECT id FROM user WHERE share_token IS NULL")).fetchall():
        conn.execute(text("UPDATE user SET share_token = :tok WHERE id = :id"), {"tok": secrets.token_urlsafe(9), "id": uid})
    for (gid,) in conn.execute(text("SELECT id FROM groups WHERE invite_token IS NULL")).fetchall():
        conn.execute(text("UPDATE groups SET invite_token = :tok WHERE id = :id"), {"tok": secrets.token_urlsafe(9), "id": gid})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        _migrate(conn)
        _backfill_groups(conn)


def get_session():
    with Session(engine) as session:
        yield session
