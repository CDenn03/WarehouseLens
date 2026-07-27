from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.inventory import TransactionType
from app.schemas.common import OrmModel


class TransactionCreate(BaseModel):
    """Manual adjustment via POST /inventory/transactions."""

    warehouse_id: UUID
    product_id: UUID
    quantity_delta: int
    type: str = TransactionType.ADJUSTMENT
    reference_id: UUID | None = None
    reason: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _valid_type(self) -> "TransactionCreate":
        if self.type not in TransactionType.ALL:
            raise ValueError(f"type must be one of {sorted(TransactionType.ALL)}")
        return self

    @model_validator(mode="after")
    def _adjustment_requires_reason(self) -> "TransactionCreate":
        # Adjustments are the one place quantity_on_hand changes with no PO or
        # shipment behind it (journeys.md Journey 4) — the reason is the only
        # audit trail, so it can't be blank for that type.
        if self.type == TransactionType.ADJUSTMENT and not (self.reason or "").strip():
            raise ValueError("reason is required for adjustment transactions")
        return self


class TransactionRead(OrmModel):
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    quantity_delta: int
    type: str
    reference_id: UUID | None
    reason: str | None
    created_by: str | None
    occurred_at: datetime
