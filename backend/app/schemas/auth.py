"""Pydantic schemas for the auth endpoints."""
from __future__ import annotations

import uuid

from pydantic import BaseModel


class RoleSummary(BaseModel):
    slug: str
    name: str

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    """Current user identity, roles and permissions in their resolved tenant.

    Used by the frontend layout to determine sidebar navigation and the
    dashboard landing page without requiring iam.user.read.

    ``dashboard`` is resolved server-side from the caller's dashboard.*
    permissions rather than left to the client, so the routing rule has exactly
    one implementation and cannot disagree with what the API will authorize.
    It is None when the caller holds no dashboard permission at all.
    """

    sub: str
    username: str
    email: str | None
    tenant_id: uuid.UUID | None
    roles: list[RoleSummary]
    permissions: list[str]
    dashboard: str | None
