"""Inventory Query tool — stock levels and reorder status, filterable by
warehouse. Example: "Which products are below reorder point in Nairobi?"

LEARNING AREA — scaffold. Signature and input model are final; the body is TODO.
"""

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import CurrentUser


class InventoryQueryInput(BaseModel):
    warehouse_id: str | None = None
    below_reorder_point: bool = False
    product_sku: str | None = None


def inventory_query_tool(input: InventoryQueryInput, db: Session, user: CurrentUser) -> dict:
    """TODO(learning): the guide's Section 7 shows the exact reference
    implementation. Steps:
      1. enforce_warehouse_scope(db, user, input.warehouse_id) — tools re-check
         scope even though the endpoint already did (defense in depth; the
         planner chose these args, not the user).
      2. Query WarehouseStock joined to Product; apply the three optional
         filters. below_reorder_point compares quantity_on_hand against
         WarehouseStock.reorder_point — per-warehouse, NOT a product-level
         value (Section 13.4). This is exactly what a naive implementation
         gets wrong.
      3. Return {"results": [...]} of plain dicts: sku, name, warehouse_id,
         quantity_on_hand, quantity_reserved, reorder_point. Keep it flat —
         the synthesize node reads this, so field names ARE the prompt.
    Note the existing service function inventory_service.product_stock_breakdown
    is close but per-product; this tool wants the warehouse-wide slice. Decide:
    reuse services vs. give tools their own fixed queries. Own queries keep the
    tool surface honest (read-only, exactly one shape); reuse avoids drift.
    """
    return {"results": [], "note": "inventory_query is a learning scaffold — not implemented"}
