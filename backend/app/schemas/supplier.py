from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class SupplierCreate(BaseModel):
    name: str = Field(max_length=200)
    lead_time_days: int | None = None
    contact_email: str | None = Field(default=None, max_length=200)


class SupplierRead(OrmModel):
    id: UUID
    name: str
    lead_time_days: int | None
    contact_email: str | None
    created_at: datetime
