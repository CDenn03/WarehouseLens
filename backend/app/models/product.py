import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, UuidPkMixin


class Product(Base, UuidPkMixin, CreatedAtMixin):
    """Global catalog — stock quantities are per-warehouse on WarehouseStock."""

    __tablename__ = "products"

    sku: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(100))
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2))


class WarehouseStock(Base):
    """What makes multi-warehouse support real. reorder_point lives here, not on
    products — per-warehouse thresholds (Section 13.4)."""

    __tablename__ = "warehouse_stock"

    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("warehouses.id"), primary_key=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id"), primary_key=True
    )
    quantity_on_hand: Mapped[int] = mapped_column(default=0)
    quantity_reserved: Mapped[int] = mapped_column(default=0)  # held by open pick lists
    reorder_point: Mapped[int] = mapped_column(default=0)

    product: Mapped[Product] = relationship(lazy="joined")
