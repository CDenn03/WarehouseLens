import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    # sqlalchemy.Uuid renders as native UUID on Postgres and CHAR(32) on SQLite,
    # which keeps the test suite runnable without a Postgres instance.
    type_annotation_map = {uuid.UUID: Uuid, datetime: DateTime(timezone=True)}


class UuidPkMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
