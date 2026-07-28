"""Shared helpers for agent tools.

Every tool with an optional ``warehouse_id`` needs the same warehouse-scope
pattern already used by every list endpoint in ``app/api/v1/*`` (Section 9):
an explicit warehouse gets the plain per-resource check; an omitted one falls
back to the caller's full visible set. Centralized here so it isn't
reimplemented slightly differently five times.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.security import CurrentUser, enforce_warehouse_scope, scope_filter_warehouse_ids


def to_uuid(value: str | None) -> UUID | None:
    return UUID(value) if value else None


def resolve_scoped_warehouse_ids(
    db: Session, user: CurrentUser, warehouse_id: UUID | None
) -> set[UUID]:
    """The set of warehouse ids a tool's query should filter to."""
    if warehouse_id is not None:
        enforce_warehouse_scope(db, user, warehouse_id)
        return {warehouse_id}
    return scope_filter_warehouse_ids(db, user)
