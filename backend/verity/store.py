"""SQLite document store. All service mutations share an IMMEDIATE transaction."""

import hashlib
import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4


def now():
    return datetime.now(UTC).isoformat()


def new_id(prefix):
    return f"{prefix}_{uuid4().hex}"


class Store:
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        (self.root / "files").mkdir(exist_ok=True, mode=0o700)
        self.path = self.root / "verity.sqlite3"
        self.path.touch(mode=0o600, exist_ok=True)
        self.path.chmod(0o600)
        with self.connection() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS objects (
                    id TEXT PRIMARY KEY, kind TEXT NOT NULL, parent TEXT,
                    data TEXT NOT NULL CHECK(json_valid(data))
                );
                CREATE INDEX IF NOT EXISTS object_lookup ON objects(kind, parent);
                CREATE TABLE IF NOT EXISTS sessions (
                    digest TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS memberships (
                    course_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL,
                    PRIMARY KEY (course_id, user_id)
                );
                PRAGMA user_version=1;
            """)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            yield db
        finally:
            db.close()

    @contextmanager
    def transaction(self):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                yield db
                db.commit()
            except BaseException:
                db.rollback()
                raise

    @staticmethod
    def get(db, kind, object_id):
        row = db.execute(
            "SELECT data FROM objects WHERE id=? AND kind=?", (object_id, kind)
        ).fetchone()
        return json.loads(row[0]) if row else None

    @staticmethod
    def all(db, kind, parent=None):
        if parent is None:
            rows = db.execute("SELECT data FROM objects WHERE kind=? ORDER BY rowid", (kind,))
        else:
            rows = db.execute(
                "SELECT data FROM objects WHERE kind=? AND parent=? ORDER BY rowid", (kind, parent)
            )
        return [json.loads(row[0]) for row in rows]

    @staticmethod
    def put(db, kind, obj, parent=None):
        db.execute(
            "INSERT INTO objects(id,kind,parent,data) VALUES(?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET data=excluded.data",
            (obj["id"], kind, parent, json.dumps(obj, allow_nan=False)),
        )
        return obj

    def audit(self, db, actor, action, target, details=None):
        self.put(
            db,
            "audit",
            {
                "id": new_id("evt"),
                "actor_id": actor,
                "action": action,
                "target_id": target,
                "details": details or {},
                "created_at": now(),
            },
            target,
        )

    def provision_user(self, name, role="student", lifetime_hours=24):
        if role not in {"student", "ta", "instructor"}:
            raise ValueError("Invalid role")
        token = secrets.token_urlsafe(40)
        user = {"id": new_id("usr"), "name": name, "role": role}
        with self.transaction() as db:
            self.put(db, "user", user)
            db.execute(
                "INSERT INTO sessions VALUES(?,?,?)",
                (
                    hashlib.sha256(token.encode()).hexdigest(),
                    user["id"],
                    (datetime.now(UTC) + timedelta(hours=lifetime_hours)).isoformat(),
                ),
            )
        return user, token

    def authenticate(self, token):
        with self.connection() as db:
            row = db.execute(
                "SELECT user_id FROM sessions WHERE digest=? AND expires_at>?",
                (hashlib.sha256(token.encode()).hexdigest(), now()),
            ).fetchone()
            return self.get(db, "user", row[0]) if row else None
