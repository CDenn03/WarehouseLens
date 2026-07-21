from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.models.inventory import TransactionType
from app.schemas.common import OrmModel


class TransactionCreate(BaseModel):
    """Manual adjustment via POST /inventory/transactions."""

    warehouse_id: UUID
    product_id: UUID
    quantity_delta: int
    type: str = TransactionType.ADJUSTMENT
    reference_id: UUID | None = None

    @field_validator("type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in TransactionType.ALL:
            raise ValueError(f"type must be one of {sorted(TransactionType.ALL)}")
        return v


class TransactionRead(OrmModel):
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    quantity_delta: int
    type: str
    reference_id: UUID | None
    occurred_at: datetime
