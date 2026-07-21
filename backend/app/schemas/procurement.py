from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class POItemCreate(BaseModel):
    product_id: UUID
    quantity_ordered: int = Field(gt=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: UUID
    destination_warehouse_id: UUID
    order_date: date
    expected_delivery_date: date | None = None
    items: list[POItemCreate] = Field(min_length=1)


class POItemRead(OrmModel):
    product_id: UUID
    quantity_ordered: int
    quantity_received: int


class PurchaseOrderRead(OrmModel):
    id: UUID
    supplier_id: UUID
    destination_warehouse_id: UUID
    status: str
    order_date: date
    expected_delivery_date: date | None
    actual_delivery_date: date | None
    created_at: datetime
    items: list[POItemRead]


class ReceiveItem(BaseModel):
    product_id: UUID
    quantity_received: int = Field(ge=0)


class PurchaseOrderReceive(BaseModel):
    """Optional partial-receipt payload; omit items to receive everything in full."""

    actual_delivery_date: date | None = None
    items: list[ReceiveItem] | None = None
