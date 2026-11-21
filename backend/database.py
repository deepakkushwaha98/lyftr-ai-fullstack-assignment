import os
import json
import sqlite3
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
DATABASE_PATH = DATABASE_URL.replace("sqlite:///", "", 1)


@contextmanager
def get_db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db():
    with get_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_session
            ON messages(session_id, id)
        """)


def save_message(session_id, role, content, metadata=None):
    with get_db() as connection:
        connection.execute(
            """
            INSERT INTO messages
                (session_id, role, content, metadata, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                session_id,
                role,
                content,
                json.dumps(metadata) if metadata is not None else None
            )
        )


def get_messages(session_id):
    with get_db() as connection:
        rows = connection.execute(
            """
            SELECT role, content, metadata
            FROM messages
            WHERE session_id = ?
            ORDER BY id ASC
            """,
            (session_id,)
        ).fetchall()

    messages = []

    for row in rows:
        item = {
            "role": row["role"],
            "content": row["content"]
        }

        if row["metadata"]:
            item["metadata"] = json.loads(row["metadata"])

        messages.append(item)

    return messages