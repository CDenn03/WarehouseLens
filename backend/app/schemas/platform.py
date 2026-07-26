"""Pydantic schemas for the platform endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator


def _clean_email(value: str) -> str:
    """Normalise and sanity-check an email.  Deliberately not a full RFC check —
    Keycloak is the authority; this only catches obvious typos before a remote
    call is made."""
    email = value.strip().lower()
    local, sep, domain = email.partition("@")
    if not sep or not local or "." not in domain:
        raise ValueError("must be a valid email address")
    return email


# ── Tenants ────────────────────────────────────────────────────────────────


class TenantCreate(BaseModel):
    name: str
    # Required: creating a tenant creates its first user.  A tenant with no way
    # in is a support ticket waiting to happen.
    admin_email: str

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("tenant name is required")
        return v.strip()

    @field_validator("admin_email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        return _clean_email(v)


class TenantUpdate(BaseModel):
    """Partial update.  Omitted fields are left untouched; setting
    ``admin_email`` to a new address provisions that person as a tenant admin."""

    name: str | None = None
    admin_email: str | None = None

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not v.strip():
            raise ValueError("tenant name cannot be empty")
        return v.strip()

    @field_validator("admin_email")
    @classmethod
    def _valid_email(cls, v: str | None) -> str | None:
        return None if v is None else _clean_email(v)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> TenantUpdate:
        if self.name is None and self.admin_email is None:
            raise ValueError("provide at least one field to update")
        return self


class TenantRead(BaseModel):
    id: uuid.UUID
    name: str
    admin_email: str | None
    is_platform: bool
    created_at: datetime
    user_count: int
    warehouse_count: int
    # Keycloak sub of the provisioned tenant admin, when one exists locally.
    admin_user_id: str | None = None

    model_config = {"from_attributes": True}


class ProvisionedAdminRead(BaseModel):
    """The account created (or reused) alongside a tenant.

    ``temporary_password`` is only populated when this call created the account —
    the caller relays it once, and Keycloak forces a change at first login.
    """

    user_id: str
    email: str
    username: str | None
    created: bool
    temporary_password: str | None = None


class TenantWithAdminRead(BaseModel):
    tenant: TenantRead
    admin: ProvisionedAdminRead | None = None


# ── Platform admins ────────────────────────────────────────────────────────


class PlatformAdminRead(BaseModel):
    id: str
    email: str
    username: str | None
    assigned_at: datetime | None

    model_config = {"from_attributes": True}


class PlatformAdminCreate(BaseModel):
    """Create by email (provisions a Keycloak account) or promote an existing
    user by id.  Exactly one of the two is required."""

    email: str | None = None
    username: str | None = None
    user_id: str | None = None

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str | None) -> str | None:
        return None if v is None else _clean_email(v)

    @model_validator(mode="after")
    def _exactly_one_identifier(self) -> PlatformAdminCreate:
        if bool(self.email) == bool(self.user_id):
            raise ValueError("provide either 'email' or 'user_id', not both")
        return self


class PlatformAdminUpdate(BaseModel):
    email: str | None = None
    username: str | None = None

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str | None) -> str | None:
        return None if v is None else _clean_email(v)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> PlatformAdminUpdate:
        if self.email is None and self.username is None:
            raise ValueError("provide at least one field to update")
        return self


class PlatformAdminWithCredentialRead(BaseModel):
    admin: PlatformAdminRead
    created: bool
    temporary_password: str | None = None


class PasswordResetRead(BaseModel):
    user_id: str
    email: str
    temporary_password: str
