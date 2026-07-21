from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class LineItemCreate(BaseModel):
    product_id: UUID
    quantity_ordered: int = Field(gt=0)


class SalesOrderCreate(BaseModel):
    source_warehouse_id: UUID
    customer_name: str | None = Field(default=None, max_length=200)
    items: list[LineItemCreate] = Field(min_length=1)


class SalesOrderRead(OrmModel):
    id: UUID
    source_warehouse_id: UUID
    customer_name: str | None
    created_at: datetime
    outbound_request_id: UUID | None = None  # set by the service on creation


class OutboundItemCreate(BaseModel):
    product_id: UUID
    quantity_requested: int = Field(gt=0)


class OutboundRequestCreate(BaseModel):
    """Direct creation = internal transfers only; external shipments go through
    POST /sales-orders (Section 6)."""

    source_warehouse_id: UUID
    destination_warehouse_id: UUID
    items: list[OutboundItemCreate] = Field(min_length=1)


class OutboundItemRead(OrmModel):
    product_id: UUID
    quantity_requested: int


class PickListItemRead(OrmModel):
    product_id: UUID
    quantity_requested: int
    quantity_picked: int
    location: str | None


class PickListRead(OrmModel):
    id: UUID
    outbound_request_id: UUID
    status: str
    assigned_to: str | None
    created_at: datetime
    completed_at: datetime | None
    items: list[PickListItemRead]


class ShipmentRead(OrmModel):
    id: UUID
    outbound_request_id: UUID
    carrier: str | None
    tracking_number: str | None
    status: str
    packed_at: datetime | None
    shipped_at: datetime | None
    delivered_at: datetime | None


class OutboundRequestRead(OrmModel):
    id: UUID
    sales_order_id: UUID | None
    source_warehouse_id: UUID
    destination_warehouse_id: UUID | None
    status: str
    created_at: datetime
    items: list[OutboundItemRead]


class OutboundRequestDetail(OutboundRequestRead):
    pick_lists: list[PickListRead]
    shipments: list[ShipmentRead]


class PickListCreate(BaseModel):
    assigned_to: str | None = Field(default=None, max_length=120)


class PickItemUpdate(BaseModel):
    quantity_picked: int = Field(ge=0)
    location: str | None = Field(default=None, max_length=60)


class ShipRequest(BaseModel):
    carrier: str | None = Field(default=None, max_length=100)
    tracking_number: str | None = Field(default=None, max_length=120)
