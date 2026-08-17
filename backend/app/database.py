"""
KrishiDrishti AI — Database Configuration
Supports PostgreSQL/PostGIS with automatic async SQLite fallback when Postgres is offline.
SQLite uses the existing krishidristi.db file for zero-config local development.
"""

import os
import socket
import logging

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("krishidristi.database")

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=convention)


class Base(DeclarativeBase):
    metadata = metadata


def _postgres_is_reachable() -> bool:
    """Quick TCP ping to check if PostgreSQL is available on localhost:5432."""
    try:
        sock = socket.create_connection(("localhost", 5432), timeout=1.5)
        sock.close()
        return True
    except OSError:
        return False


# Determine which DB to use: prefer Postgres if reachable, else fall back to SQLite
_sqlite_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "krishidristi.db")
_sqlite_url = f"sqlite+aiosqlite:///{_sqlite_path}"

if "postgresql" in settings.DATABASE_URL and _postgres_is_reachable():
    db_url = settings.DATABASE_URL
    _connect_args: dict = {}
    logger.info("[DB] Connected to PostgreSQL at localhost:5432")
    print("[DB] Using PostgreSQL database.")
else:
    db_url = _sqlite_url
    _connect_args = {"check_same_thread": False}
    logger.info(f"[DB] PostgreSQL unavailable — falling back to SQLite: {_sqlite_path}")
    print(f"[DB] Using SQLite fallback: {_sqlite_path}")

engine = create_async_engine(
    db_url,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {}
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """Dependency that yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
