"""Inventory Query tool — stock levels and reorder status, filterable by
warehouse. Example: "Which products are below reorder point in Nairobi?"
"""

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.tools._common import resolve_scoped_warehouse_ids, to_uuid
from app.core.security import CurrentUser
from app.models import Product, Warehouse, WarehouseStock


class InventoryQueryInput(BaseModel):
    warehouse_id: str | None = None
    below_reorder_point: bool = False
    product_sku: str | None = None


def inventory_query_tool(input: InventoryQueryInput, db: Session, user: CurrentUser) -> dict:
    """Own query (not a service wrapper) — the exact warehouse-wide slice this
    tool wants doesn't match any single existing service function's shape.

    Omitting both ``warehouse_id`` and ``product_sku`` returns every visible
    warehouse's stock for every product; omitting only ``warehouse_id`` with a
    ``product_sku`` set returns that product across every visible warehouse —
    which is what answers a "compare this SKU's reorder point across
    warehouses" question without needing a second input field for it.
    """
    warehouse_id = to_uuid(input.warehouse_id)
    visible = resolve_scoped_warehouse_ids(db, user, warehouse_id)

    stmt = (
        select(WarehouseStock, Product, Warehouse.name)
        .join(Product, Product.id == WarehouseStock.product_id)
        .join(Warehouse, Warehouse.id == WarehouseStock.warehouse_id)
        .where(WarehouseStock.warehouse_id.in_(visible))
        .order_by(Warehouse.name, Product.sku)
    )
    if input.below_reorder_point:
        stmt = stmt.where(WarehouseStock.quantity_on_hand < WarehouseStock.reorder_point)
    if input.product_sku:
        stmt = stmt.where(Product.sku == input.product_sku)

    rows = db.execute(stmt).all()
    return {
        "results": [
            {
                "sku": product.sku,
                "name": product.name,
                "warehouse_id": str(stock.warehouse_id),
                "warehouse_name": warehouse_name,
                "quantity_on_hand": stock.quantity_on_hand,
                "quantity_reserved": stock.quantity_reserved,
                "reorder_point": stock.reorder_point,
            }
            for stock, product, warehouse_name in rows
        ]
    }
