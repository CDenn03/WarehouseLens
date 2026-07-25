"""Pydantic schemas for the IAM endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


# ── Role schemas ───────────────────────────────────────────────────────────


class RoleRead(BaseModel):
    id: uuid.UUID
    slug: str
    name: str

    model_config = {"from_attributes": True}


# ── Warehouse assignment schemas ───────────────────────────────────────────


class WarehouseAssignmentRead(BaseModel):
    warehouse_id: uuid.UUID
    warehouse_name: str
    assigned_at: datetime

    model_config = {"from_attributes": True}


# ── User schemas ───────────────────────────────────────────────────────────


class UserRead(BaseModel):
    """User record as returned by the IAM admin endpoints."""

    id: str
    email: str
    username: str | None
    deleted_at: datetime | None
    roles: list[RoleRead]
    warehouse_assignments: list[WarehouseAssignmentRead]
    # True when the user holds warehouse.global — show "Global access" instead
    # of the (potentially empty) warehouse list.
    has_global_warehouse_access: bool

    model_config = {"from_attributes": True}


# ── Request bodies ─────────────────────────────────────────────────────────


class AssignRoleRequest(BaseModel):
    role_slug: str


class AssignWarehouseRequest(BaseModel):
    warehouse_id: uuid.UUID
