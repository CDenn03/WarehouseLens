import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, UuidPkMixin


class OutboundStatus:
    REQUESTED = "requested"
    PICKING = "picking"
    PACKED = "packed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

    OPEN = {REQUESTED, PICKING, PACKED}


class PickListStatus:
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"


class ShipmentStatus:
    PACKED = "packed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"


class SalesOrder(Base, UuidPkMixin, CreatedAtMixin):
    """Minimal stub (Section 13.1) — no status machine on purpose. Creating one
    immediately generates the linked outbound_request, which is then the single
    source of truth for what's happened since."""

    __tablename__ = "sales_orders"

    source_warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"))
    customer_name: Mapped[str | None] = mapped_column(String(200))

    items: Mapped[list["SalesOrderItem"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    sales_order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sales_orders.id"), primary_key=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), primary_key=True)
    quantity_ordered: Mapped[int]


class OutboundRequest(Base, UuidPkMixin, CreatedAtMixin):
    __tablename__ = "outbound_requests"

    # NULL = internal transfer, created directly (Section 13.1)
    sales_order_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sales_orders.id"))
    source_warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"))
    # NULL = external destination
    destination_warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("warehouses.id")
    )
    status: Mapped[str] = mapped_column(String(30), default=OutboundStatus.REQUESTED)

    items: Mapped[list["OutboundRequestItem"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    pick_lists: Mapped[list["PickList"]] = relationship(
        back_populates="outbound_request", lazy="selectin"
    )
    shipments: Mapped[list["Shipment"]] = relationship(lazy="selectin")

    @property
    def is_internal_transfer(self) -> bool:
        return self.destination_warehouse_id is not None


class OutboundRequestItem(Base):
    __tablename__ = "outbound_request_items"

    outbound_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("outbound_requests.id"), primary_key=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), primary_key=True)
    quantity_requested: Mapped[int]


class PickList(Base, UuidPkMixin, CreatedAtMixin):
    __tablename__ = "pick_lists"

    outbound_request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("outbound_requests.id"))
    status: Mapped[str] = mapped_column(String(30), default=PickListStatus.OPEN)
    assigned_to: Mapped[str | None] = mapped_column(String(120))
    completed_at: Mapped[datetime | None]

    outbound_request: Mapped[OutboundRequest] = relationship(back_populates="pick_lists")
    items: Mapped[list["PickListItem"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class PickListItem(Base):
    __tablename__ = "pick_list_items"

    pick_list_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pick_lists.id"), primary_key=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), primary_key=True)
    quantity_requested: Mapped[int]
    quantity_picked: Mapped[int] = mapped_column(default=0)
    # free text, e.g. "Aisle 4B" — deliberately not a bins/zones model (Section 13.2)
    location: Mapped[str | None] = mapped_column(String(60))


class Shipment(Base, UuidPkMixin):
    __tablename__ = "shipments"

    outbound_request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("outbound_requests.id"))
    carrier: Mapped[str | None] = mapped_column(String(100))
    tracking_number: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(30), default=ShipmentStatus.PACKED)
    packed_at: Mapped[datetime | None]
    shipped_at: Mapped[datetime | None]
    delivered_at: Mapped[datetime | None]
