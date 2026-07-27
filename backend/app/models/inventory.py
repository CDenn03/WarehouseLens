import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UuidPkMixin, utcnow


class TransactionType:
    RECEIPT = "receipt"
    ISSUE = "issue"
    ADJUSTMENT = "adjustment"
    TRANSFER_OUT = "transfer_out"
    TRANSFER_IN = "transfer_in"

    ALL = {RECEIPT, ISSUE, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN}


class InventoryTransaction(Base, UuidPkMixin):
    """Source of truth for all stock movement; also the forecasting model's input."""

    __tablename__ = "inventory_transactions"
    __table_args__ = (
        Index("ix_inv_tx_wh_product_time", "warehouse_id", "product_id", "occurred_at"),
    )

    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"))
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))
    quantity_delta: Mapped[int]  # positive = receipt, negative = issue
    type: Mapped[str] = mapped_column(String(30))
    reference_id: Mapped[uuid.UUID | None]  # optional FK to a PO, shipment, etc.
    occurred_at: Mapped[datetime] = mapped_column(default=utcnow)
    created_by: Mapped[str | None] = mapped_column(
        String(120), ForeignKey("users.id"), nullable=True
    )
    # Free-text "why" for manual corrections (Section 4 of journeys.md) — the
    # only audit trail an adjustment has, since receipts/shipments/transfers
    # already point back at a PO/shipment via reference_id.
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
