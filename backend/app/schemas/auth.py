"""Pydantic schemas for the auth endpoints."""
from __future__ import annotations

import uuid

from pydantic import BaseModel


class RoleSummary(BaseModel):
    slug: str
    name: str

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    """Current user identity + roles scoped to their resolved tenant.

    Used by the frontend layout to determine sidebar navigation
    (platform admin vs tenant user) without requiring iam.user.read.
    """

    sub: str
    username: str
    email: str | None
    tenant_id: uuid.UUID | None
    roles: list[RoleSummary]
