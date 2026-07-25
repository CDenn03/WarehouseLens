"""Pydantic schemas for the platform endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class TenantCreate(BaseModel):
    name: str
    superuser_email: str | None = None


class TenantRead(BaseModel):
    id: uuid.UUID
    name: str
    superuser_email: str | None
    is_platform: bool
    created_at: datetime
    user_count: int

    model_config = {"from_attributes": True}


class PlatformAdminRead(BaseModel):
    id: str
    email: str
    username: str | None
    assigned_at: datetime | None

    model_config = {"from_attributes": True}


class AssignPlatformAdminRequest(BaseModel):
    user_id: str
