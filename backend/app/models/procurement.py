import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, UuidPkMixin


class POStatus:
    PENDING = "pending"
    CONFIRMED = "confirmed"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class PurchaseOrder(Base, UuidPkMixin, CreatedAtMixin):
    __tablename__ = "purchase_orders"

    supplier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("suppliers.id"))
    destination_warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"))
    status: Mapped[str] = mapped_column(String(30), default=POStatus.PENDING)
    order_date: Mapped[date] = mapped_column(Date)
    expected_delivery_date: Mapped[date | None] = mapped_column(Date)
    actual_delivery_date: Mapped[date | None] = mapped_column(Date)

    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan", lazy="selectin"
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("purchase_orders.id"), primary_key=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), primary_key=True)
    quantity_ordered: Mapped[int]
    quantity_received: Mapped[int] = mapped_column(default=0)

    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="items")
