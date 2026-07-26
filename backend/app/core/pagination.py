"""Reusable pagination helpers for SQLAlchemy list queries."""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select


@dataclass
class PaginationParams:
    page: int = 1
    page_size: int = 20
    search: str | None = None
    sort_by: str | None = None
    sort_order: str = "desc"

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def count_rows(db: Session, stmt: Select) -> int:
    """Return the total number of rows matching *stmt*."""
    return db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()


def paginate(
    db: Session,
    stmt: Select,
    params: PaginationParams,
    schema: type[BaseModel] | None = None,
) -> dict:
    """Count, offset/limit, and return the standard paginated envelope dict."""
    total = count_rows(db, stmt)
    rows = list(db.execute(stmt.offset(params.offset).limit(params.page_size)).scalars())
    if schema is not None:
        items = [schema.model_validate(r, from_attributes=True) for r in rows]
    else:
        items = rows
    total_pages = max(1, (total + params.page_size - 1) // params.page_size)
    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": total_pages,
    }
