from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class WarehouseCreate(BaseModel):
    name: str = Field(max_length=120)
    address: str | None = Field(default=None, max_length=255)


class WarehouseRead(OrmModel):
    id: UUID
    name: str
    address: str | None
    is_active: bool
    created_at: datetime


class AssignmentCreate(BaseModel):
    """Assigns a Keycloak user (JWT `sub`) to the warehouse in the path."""

    user_id: str = Field(max_length=120)


class AssignmentRead(OrmModel):
    user_id: str
    warehouse_id: UUID
