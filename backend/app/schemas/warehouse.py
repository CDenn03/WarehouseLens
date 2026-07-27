from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import OrmModel


class WarehouseCreate(BaseModel):
    name: str = Field(max_length=120)
    address: str | None = Field(default=None, max_length=255)


class WarehouseUpdate(BaseModel):
    """PATCH /warehouses/{id} — edit name/address, or deactivate/reactivate."""

    name: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "WarehouseUpdate":
        if self.name is None and self.address is None and self.is_active is None:
            raise ValueError("provide at least one field to update")
        return self


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
