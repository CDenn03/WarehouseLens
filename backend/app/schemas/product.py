from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class ProductCreate(BaseModel):
    sku: str = Field(max_length=64)
    name: str = Field(max_length=200)
    category: str | None = Field(default=None, max_length=100)
    unit_cost: Decimal


class ProductRead(OrmModel):
    id: UUID
    sku: str
    name: str
    category: str | None
    unit_cost: Decimal
    created_at: datetime


class WarehouseStockRead(BaseModel):
    warehouse_id: UUID
    warehouse_name: str
    quantity_on_hand: int
    quantity_reserved: int
    reorder_point: int
    below_reorder_point: bool


class ProductStockBreakdown(BaseModel):
    product: ProductRead
    stock: list[WarehouseStockRead]
