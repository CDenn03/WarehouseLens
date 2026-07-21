from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models import InventoryTransaction, Product, Warehouse, WarehouseStock
from app.schemas.inventory import TransactionCreate
from app.schemas.product import ProductCreate, ProductStockBreakdown, ProductRead, WarehouseStockRead


# --- products -------------------------------------------------------------

def list_products(db: Session, search: str | None = None) -> list[Product]:
    stmt = select(Product).order_by(Product.sku)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(Product.sku.ilike(pattern) | Product.name.ilike(pattern))
    return list(db.execute(stmt).scalars())


def get_product(db: Session, product_id: UUID) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise NotFoundError(f"product {product_id} not found")
    return product


def create_product(db: Session, data: ProductCreate) -> Product:
    if db.execute(select(Product).where(Product.sku == data.sku)).scalar_one_or_none():
        raise ConflictError(f"SKU {data.sku} already exists")
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    return product


def product_stock_breakdown(
    db: Session, product_id: UUID, visible_warehouse_ids: set[UUID] | None
) -> ProductStockBreakdown:
    """Per-warehouse stock for one product, filtered to the caller's scope
    (visible_warehouse_ids=None means global)."""
    product = get_product(db, product_id)
    stmt = (
        select(WarehouseStock, Warehouse.name)
        .join(Warehouse, Warehouse.id == WarehouseStock.warehouse_id)
        .where(WarehouseStock.product_id == product_id)
        .order_by(Warehouse.name)
    )
    rows = db.execute(stmt).all()
    stock = [
        WarehouseStockRead(
            warehouse_id=ws.warehouse_id,
            warehouse_name=name,
            quantity_on_hand=ws.quantity_on_hand,
            quantity_reserved=ws.quantity_reserved,
            reorder_point=ws.reorder_point,
            below_reorder_point=ws.quantity_on_hand < ws.reorder_point,
        )
        for ws, name in rows
        if visible_warehouse_ids is None or ws.warehouse_id in visible_warehouse_ids
    ]
    return ProductStockBreakdown(product=ProductRead.model_validate(product), stock=stock)


# --- stock movement -------------------------------------------------------

def get_or_create_stock_row(db: Session, warehouse_id: UUID, product_id: UUID) -> WarehouseStock:
    row = db.get(WarehouseStock, (warehouse_id, product_id))
    if row is None:
        row = WarehouseStock(warehouse_id=warehouse_id, product_id=product_id)
        db.add(row)
        db.flush()
    return row


def apply_movement(
    db: Session,
    warehouse_id: UUID,
    product_id: UUID,
    quantity_delta: int,
    tx_type: str,
    reference_id: UUID | None = None,
) -> InventoryTransaction:
    """The single choke point for stock movement: writes the transaction row
    (source of truth, Section 5) and keeps warehouse_stock.quantity_on_hand in
    sync. Callers commit. Stock is never allowed below zero."""
    stock = get_or_create_stock_row(db, warehouse_id, product_id)
    if stock.quantity_on_hand + quantity_delta < 0:
        raise ConflictError(
            f"movement of {quantity_delta} would take product {product_id} below zero "
            f"in warehouse {warehouse_id} (on hand: {stock.quantity_on_hand})"
        )
    stock.quantity_on_hand += quantity_delta
    tx = InventoryTransaction(
        warehouse_id=warehouse_id,
        product_id=product_id,
        quantity_delta=quantity_delta,
        type=tx_type,
        reference_id=reference_id,
    )
    db.add(tx)
    return tx


def create_manual_transaction(db: Session, data: TransactionCreate) -> InventoryTransaction:
    get_product(db, data.product_id)
    if db.get(Warehouse, data.warehouse_id) is None:
        raise NotFoundError(f"warehouse {data.warehouse_id} not found")
    tx = apply_movement(
        db, data.warehouse_id, data.product_id, data.quantity_delta, data.type, data.reference_id
    )
    db.commit()
    return tx


def list_transactions(
    db: Session,
    visible_warehouse_ids: set[UUID] | None,
    warehouse_id: UUID | None = None,
    product_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 200,
) -> list[InventoryTransaction]:
    stmt = select(InventoryTransaction).order_by(InventoryTransaction.occurred_at.desc()).limit(limit)
    if warehouse_id is not None:
        stmt = stmt.where(InventoryTransaction.warehouse_id == warehouse_id)
    elif visible_warehouse_ids is not None:
        stmt = stmt.where(InventoryTransaction.warehouse_id.in_(visible_warehouse_ids))
    if product_id is not None:
        stmt = stmt.where(InventoryTransaction.product_id == product_id)
    if date_from is not None:
        stmt = stmt.where(
            InventoryTransaction.occurred_at >= datetime.combine(date_from, time.min, timezone.utc)
        )
    if date_to is not None:
        stmt = stmt.where(
            InventoryTransaction.occurred_at <= datetime.combine(date_to, time.max, timezone.utc)
        )
    return list(db.execute(stmt).scalars())
