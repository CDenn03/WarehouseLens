from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models import PurchaseOrder, PurchaseOrderItem, Supplier
from app.models.inventory import TransactionType
from app.models.procurement import POStatus
from app.schemas.procurement import PurchaseOrderCreate, PurchaseOrderReceive
from app.schemas.supplier import SupplierCreate
from app.services import inventory_service, warehouse_service


# --- suppliers ------------------------------------------------------------

def list_suppliers(db: Session) -> list[Supplier]:
    return list(db.execute(select(Supplier).order_by(Supplier.name)).scalars())


def create_supplier(db: Session, data: SupplierCreate) -> Supplier:
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    return supplier


# --- purchase orders ------------------------------------------------------

def list_purchase_orders(
    db: Session,
    visible_warehouse_ids: set[UUID] | None,
    warehouse_id: UUID | None = None,
    status: str | None = None,
) -> list[PurchaseOrder]:
    stmt = select(PurchaseOrder).order_by(PurchaseOrder.order_date.desc())
    if warehouse_id is not None:
        stmt = stmt.where(PurchaseOrder.destination_warehouse_id == warehouse_id)
    elif visible_warehouse_ids is not None:
        stmt = stmt.where(PurchaseOrder.destination_warehouse_id.in_(visible_warehouse_ids))
    if status is not None:
        stmt = stmt.where(PurchaseOrder.status == status)
    return list(db.execute(stmt).scalars())


def get_purchase_order(db: Session, po_id: UUID) -> PurchaseOrder:
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise NotFoundError(f"purchase order {po_id} not found")
    return po


def create_purchase_order(db: Session, data: PurchaseOrderCreate) -> PurchaseOrder:
    if db.get(Supplier, data.supplier_id) is None:
        raise NotFoundError(f"supplier {data.supplier_id} not found")
    warehouse_service.get_warehouse(db, data.destination_warehouse_id)
    for item in data.items:
        inventory_service.get_product(db, item.product_id)

    po = PurchaseOrder(
        supplier_id=data.supplier_id,
        destination_warehouse_id=data.destination_warehouse_id,
        order_date=data.order_date,
        expected_delivery_date=data.expected_delivery_date,
        items=[
            PurchaseOrderItem(product_id=i.product_id, quantity_ordered=i.quantity_ordered)
            for i in data.items
        ],
    )
    db.add(po)
    db.commit()
    return po


def receive_purchase_order(db: Session, po_id: UUID, data: PurchaseOrderReceive) -> PurchaseOrder:
    """Marks the PO received and writes one `receipt` inventory transaction per
    line, which is what actually moves stock. Partial receipt supported via the
    optional items payload; omitted lines receive in full."""
    po = get_purchase_order(db, po_id)
    if po.status in (POStatus.RECEIVED, POStatus.CANCELLED):
        raise ConflictError(f"purchase order is {po.status}; cannot receive")

    received_by_product = (
        {i.product_id: i.quantity_received for i in data.items} if data.items else None
    )
    for item in po.items:
        qty = (
            item.quantity_ordered
            if received_by_product is None
            else received_by_product.get(item.product_id, 0)
        )
        if qty <= 0:
            continue
        item.quantity_received += qty
        inventory_service.apply_movement(
            db,
            warehouse_id=po.destination_warehouse_id,
            product_id=item.product_id,
            quantity_delta=qty,
            tx_type=TransactionType.RECEIPT,
            reference_id=po.id,
        )

    po.status = POStatus.RECEIVED
    po.actual_delivery_date = data.actual_delivery_date or date.today()
    db.commit()
    return po
