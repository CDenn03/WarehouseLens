"""Shared helpers for agent tools.

Every tool with an optional ``warehouse_id`` needs the same warehouse-scope
pattern already used by every list endpoint in ``app/api/v1/*`` (Section 9):
an explicit warehouse gets the plain per-resource check; an omitted one falls
back to the caller's full visible set. Centralized here so it isn't
reimplemented slightly differently five times.
"""

from typing import TypeVar
from uuid import UUID

from sqlalchemy import Select
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, enforce_warehouse_scope, scope_filter_warehouse_ids

# Hard cap on rows a single-row-per-result tool (inventory_query,
# outbound_status) hands to the synthesize LLM. Well above any seeded/eval
# dataset size — this exists so a real, large catalog can't silently blow up
# token cost/latency or get truncated by the LLM's own context window instead
# of ours. Tools that aggregate rows into fewer output rows (e.g.
# supplier_performance, which folds many POs into one row per supplier) don't
# need this: capping there would corrupt the aggregate math, not just the
# list length.
MAX_ROWS = 500

_T = TypeVar("_T")


def capped(stmt: Select, limit: int = MAX_ROWS) -> Select:
    """Fetch one row past the cap so the caller can detect truncation without
    a separate COUNT query."""
    return stmt.limit(limit + 1)


def cap_rows(rows: list[_T], limit: int = MAX_ROWS) -> tuple[list[_T], bool]:
    """Pair with `capped()`: slice back to `limit` and report whether the
    query's actual match count ran past it."""
    if len(rows) > limit:
        return rows[:limit], True
    return rows, False


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
