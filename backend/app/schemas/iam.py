"""Pydantic schemas for the IAM endpoints."""
from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator


def _slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


# ── Role schemas ───────────────────────────────────────────────────────────


class RoleRead(BaseModel):
    id: uuid.UUID
    slug: str
    name: str

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str
    slug: str | None = None
    permission_ids: list[str] | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("role name is required")
        return v.strip()

    @model_validator(mode="after")
    def _generate_slug(self) -> RoleCreate:
        if not self.slug:
            self.slug = _slugify(self.name)
        return self


class RoleUpdate(BaseModel):
    name: str | None = None
    permission_ids: list[str] | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not v.strip():
            raise ValueError("role name cannot be empty")
        return v.strip()

    @model_validator(mode="after")
    def _at_least_one_field(self) -> RoleUpdate:
        if self.name is None and self.permission_ids is None:
            raise ValueError("provide at least one field to update")
        return self


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
    has_global_warehouse_access: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    """Create a new user — provisions a Keycloak account."""

    email: str
    username: str | None = None
    role_slug: str | None = None

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        email = v.strip().lower()
        local, sep, domain = email.partition("@")
        if not sep or not local or "." not in domain:
            raise ValueError("must be a valid email address")
        return email


class UserUpdate(BaseModel):
    """Partial update for user email/username/role."""

    email: str | None = None
    username: str | None = None
    role_slug: str | None = None

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        email = v.strip().lower()
        local, sep, domain = email.partition("@")
        if not sep or not local or "." not in domain:
            raise ValueError("must be a valid email address")
        return email

    @model_validator(mode="after")
    def _at_least_one_field(self) -> UserUpdate:
        if self.email is None and self.username is None and self.role_slug is None:
            raise ValueError("provide at least one field to update")
        return self


# ── Request bodies ─────────────────────────────────────────────────────────


class AssignRoleRequest(BaseModel):
    role_slug: str


class AssignWarehouseRequest(BaseModel):
    warehouse_id: uuid.UUID


# ── Activity schemas ───────────────────────────────────────────────────────


class UserActivityEntry(BaseModel):
    kind: str  # "role_assigned" | "role_revoked" | "warehouse_assigned" | "warehouse_revoked"
    target: str  # role name or warehouse name
    actor_label: str  # who did it
    occurred_at: datetime

    model_config = {"from_attributes": True}


# ── Permission schemas ───────────────────────────────────────────────────


class PermissionRead(BaseModel):
    id: str
    description: str
    category: str

    model_config = {"from_attributes": True}


class RoleDetailUser(BaseModel):
    id: str
    email: str
    username: str | None

    model_config = {"from_attributes": True}


class RoleDetailRead(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    permissions: list[PermissionRead]
    users: list[RoleDetailUser]
