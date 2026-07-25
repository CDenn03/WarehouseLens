from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Request-scoped session.

    Commits on success so that writes flushed by dependencies (identity upsert,
    tenant bootstrap) are not silently discarded.  Without the commit the
    session rolls back on close, every request re-attempts the same inserts,
    and concurrent requests deadlock on the duplicate primary keys.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
