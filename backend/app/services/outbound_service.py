"""The picking → packing → shipping workflow.

Status flow on outbound_requests (single source of truth once created —
Section 13.1): requested → picking (pick list generated) → packed (pick list
completed, stock reserved) → shipped (shipment created, stock leaves) →
delivered (transfer_in written at destination if internal).

Reservation semantics: completing a pick list moves picked quantity into
warehouse_stock.quantity_reserved (on-hand unchanged — the goods are still in
the building, just spoken for). Shipping decrements both.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, InsufficientStockError, NotFoundError
from app.models import (
    OutboundRequest,
    OutboundRequestItem,
    PickList,
    PickListItem,
    SalesOrder,
    SalesOrderItem,
    Shipment,
)
from app.models.base import utcnow
from app.models.inventory import TransactionType
from app.models.outbound import OutboundStatus, PickListStatus, ShipmentStatus
from app.schemas.outbound import (
    OutboundRequestCreate,
    PickItemUpdate,
    PickListCreate,
    SalesOrderCreate,
    ShipRequest,
)
from app.services import inventory_service, warehouse_service


# --- creation -------------------------------------------------------------

def create_sales_order(db: Session, data: SalesOrderCreate) -> tuple[SalesOrder, OutboundRequest]:
    """The sales-order stub's sole job: exist, then immediately trigger the
    linked outbound request (Section 13.1)."""
    warehouse_service.get_warehouse(db, data.source_warehouse_id)
    for item in data.items:
        inventory_service.get_product(db, item.product_id)

    order = SalesOrder(
        source_warehouse_id=data.source_warehouse_id,
        customer_name=data.customer_name,
        items=[
            SalesOrderItem(product_id=i.product_id, quantity_ordered=i.quantity_ordered)
            for i in data.items
        ],
    )
    db.add(order)
    db.flush()

    request = OutboundRequest(
        sales_order_id=order.id,
        source_warehouse_id=data.source_warehouse_id,
        destination_warehouse_id=None,  # sales orders always ship externally
        items=[
            OutboundRequestItem(product_id=i.product_id, quantity_requested=i.quantity_ordered)
            for i in data.items
        ],
    )
    db.add(request)
    db.commit()
    return order, request


def create_internal_transfer(db: Session, data: OutboundRequestCreate) -> OutboundRequest:
    warehouse_service.get_warehouse(db, data.source_warehouse_id)
    warehouse_service.get_warehouse(db, data.destination_warehouse_id)
    if data.source_warehouse_id == data.destination_warehouse_id:
        raise ConflictError("source and destination warehouse must differ")
    for item in data.items:
        inventory_service.get_product(db, item.product_id)

    request = OutboundRequest(
        sales_order_id=None,
        source_warehouse_id=data.source_warehouse_id,
        destination_warehouse_id=data.destination_warehouse_id,
        items=[
            OutboundRequestItem(product_id=i.product_id, quantity_requested=i.quantity_requested)
            for i in data.items
        ],
    )
    db.add(request)
    db.commit()
    return request


# --- queries ---------------------------------------------------------------

def list_outbound_requests(
    db: Session,
    visible_warehouse_ids: set[UUID] | None,
    warehouse_id: UUID | None = None,
    status: str | None = None,
) -> list[OutboundRequest]:
    stmt = select(OutboundRequest).order_by(OutboundRequest.created_at.desc())
    if warehouse_id is not None:
        stmt = stmt.where(OutboundRequest.source_warehouse_id == warehouse_id)
    elif visible_warehouse_ids is not None:
        stmt = stmt.where(OutboundRequest.source_warehouse_id.in_(visible_warehouse_ids))
    if status is not None:
        stmt = stmt.where(OutboundRequest.status == status)
    return list(db.execute(stmt).scalars())


def get_outbound_request(db: Session, request_id: UUID) -> OutboundRequest:
    request = db.get(OutboundRequest, request_id)
    if request is None:
        raise NotFoundError(f"outbound request {request_id} not found")
    return request


def get_shipment(db: Session, shipment_id: UUID) -> Shipment:
    shipment = db.get(Shipment, shipment_id)
    if shipment is None:
        raise NotFoundError(f"shipment {shipment_id} not found")
    return shipment


def get_pick_list(db: Session, pick_list_id: UUID) -> PickList:
    pick_list = db.get(PickList, pick_list_id)
    if pick_list is None:
        raise NotFoundError(f"pick list {pick_list_id} not found")
    return pick_list


# --- picking ---------------------------------------------------------------

def generate_pick_list(db: Session, request_id: UUID, data: PickListCreate) -> PickList:
    request = get_outbound_request(db, request_id)
    if request.status != OutboundStatus.REQUESTED:
        raise ConflictError(f"outbound request is {request.status}; pick list needs 'requested'")

    pick_list = PickList(
        outbound_request_id=request.id,
        assigned_to=data.assigned_to,
        items=[
            PickListItem(product_id=i.product_id, quantity_requested=i.quantity_requested)
            for i in request.items
        ],
    )
    db.add(pick_list)
    request.status = OutboundStatus.PICKING
    db.commit()
    return pick_list


def record_pick(
    db: Session, pick_list_id: UUID, product_id: UUID, data: PickItemUpdate
) -> PickListItem:
    pick_list = get_pick_list(db, pick_list_id)
    if pick_list.status == PickListStatus.COMPLETE:
        raise ConflictError("pick list is already complete")
    item = db.get(PickListItem, (pick_list_id, product_id))
    if item is None:
        raise NotFoundError(f"product {product_id} is not on pick list {pick_list_id}")
    if data.quantity_picked > item.quantity_requested:
        raise ConflictError(
            f"picked {data.quantity_picked} exceeds requested {item.quantity_requested}"
        )
    item.quantity_picked = data.quantity_picked
    if data.location is not None:
        item.location = data.location
    pick_list.status = PickListStatus.IN_PROGRESS
    db.commit()
    return item


def complete_pick_list(db: Session, pick_list_id: UUID) -> PickList:
    """Closes the pick list and reserves picked stock for packing. Requires
    every line to have available (on hand minus already-reserved) stock."""
    pick_list = get_pick_list(db, pick_list_id)
    if pick_list.status == PickListStatus.COMPLETE:
        raise ConflictError("pick list is already complete")
    request = pick_list.outbound_request

    for item in pick_list.items:
        if item.quantity_picked <= 0:
            continue
        stock = inventory_service.get_or_create_stock_row(
            db, request.source_warehouse_id, item.product_id
        )
        available = stock.quantity_on_hand - stock.quantity_reserved
        if item.quantity_picked > available:
            raise InsufficientStockError(
                f"cannot reserve {item.quantity_picked} of product {item.product_id}: "
                f"only {available} available in warehouse {request.source_warehouse_id}"
            )
        stock.quantity_reserved += item.quantity_picked

    pick_list.status = PickListStatus.COMPLETE
    pick_list.completed_at = utcnow()
    request.status = OutboundStatus.PACKED
    db.commit()
    return pick_list


# --- shipping --------------------------------------------------------------

def ship(db: Session, request_id: UUID, data: ShipRequest) -> Shipment:
    """Creates the shipment, writes the stock-out transactions (issue for
    external, transfer_out for internal), releases the reservation, and moves
    the request to shipped."""
    request = get_outbound_request(db, request_id)
    if request.status != OutboundStatus.PACKED:
        raise ConflictError(f"outbound request is {request.status}; shipping needs 'packed'")

    picked = _picked_quantities(db, request)
    if not picked:
        raise ConflictError("nothing was picked; cannot ship")

    tx_type = (
        TransactionType.TRANSFER_OUT if request.is_internal_transfer else TransactionType.ISSUE
    )
    now = utcnow()
    shipment = Shipment(
        outbound_request_id=request.id,
        carrier=data.carrier,
        tracking_number=data.tracking_number,
        status=ShipmentStatus.SHIPPED,
        packed_at=now,
        shipped_at=now,
    )
    db.add(shipment)
    db.flush()

    for product_id, qty in picked.items():
        stock = inventory_service.get_or_create_stock_row(
            db, request.source_warehouse_id, product_id
        )
        stock.quantity_reserved = max(0, stock.quantity_reserved - qty)
        inventory_service.apply_movement(
            db,
            warehouse_id=request.source_warehouse_id,
            product_id=product_id,
            quantity_delta=-qty,
            tx_type=tx_type,
            reference_id=shipment.id,
        )

    request.status = OutboundStatus.SHIPPED
    db.commit()
    return shipment


def deliver(db: Session, shipment_id: UUID) -> Shipment:
    """Marks delivered; for internal transfers, writes the matching transfer_in
    at the destination so stock reappears there."""
    shipment = get_shipment(db, shipment_id)
    if shipment.status == ShipmentStatus.DELIVERED:
        raise ConflictError("shipment is already delivered")
    if shipment.status != ShipmentStatus.SHIPPED:
        raise ConflictError(f"shipment is {shipment.status}; delivering needs 'shipped'")

    request = get_outbound_request(db, shipment.outbound_request_id)
    if request.is_internal_transfer:
        for product_id, qty in _picked_quantities(db, request).items():
            inventory_service.apply_movement(
                db,
                warehouse_id=request.destination_warehouse_id,
                product_id=product_id,
                quantity_delta=qty,
                tx_type=TransactionType.TRANSFER_IN,
                reference_id=shipment.id,
            )

    shipment.status = ShipmentStatus.DELIVERED
    shipment.delivered_at = utcnow()
    request.status = OutboundStatus.DELIVERED
    db.commit()
    return shipment


def _picked_quantities(db: Session, request: OutboundRequest) -> dict[UUID, int]:
    """Total picked per product across the request's completed pick lists."""
    totals: dict[UUID, int] = {}
    for pick_list in request.pick_lists:
        if pick_list.status != PickListStatus.COMPLETE:
            continue
        for item in pick_list.items:
            if item.quantity_picked > 0:
                totals[item.product_id] = totals.get(item.product_id, 0) + item.quantity_picked
    return totals
