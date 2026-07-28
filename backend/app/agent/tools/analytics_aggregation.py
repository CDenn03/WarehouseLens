"""Analytics Aggregation tool — dashboard KPIs, optionally scoped to one
warehouse. Example: "What's our total inventory value across all warehouses?"
"""

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.tools._common import resolve_scoped_warehouse_ids, to_uuid
from app.core.security import CurrentUser
from app.models import Warehouse
from app.services import dashboard_service


class AnalyticsAggregationInput(BaseModel):
    warehouse_id: str | None = None  # None = all-warehouse rollup (if role allows)
    metrics: list[str] = ["total_inventory_value", "skus_below_reorder_point", "open_outbound_requests"]


def _pick(kpis, metrics: list[str]) -> dict:
    data = kpis.model_dump(mode="json")  # Decimal -> JSON-safe primitives
    return {k: data[k] for k in metrics if k in data}


def analytics_aggregation_tool(
    input: AnalyticsAggregationInput, db: Session, user: CurrentUser
) -> dict:
    """Thin pass-through to dashboard_service.get_kpis — the one tool where
    "reuse the service" is unambiguous, the shapes match exactly.

    When no single warehouse is requested and more than one is visible, also
    includes a per-warehouse breakdown alongside the aggregate rollup — that's
    what lets "which warehouse has the most inventory value" be answered from
    this tool's output without a second input field for it. The input schema
    is unchanged; only the response is enriched.
    """
    warehouse_id = to_uuid(input.warehouse_id)
    visible = resolve_scoped_warehouse_ids(db, user, warehouse_id)

    result: dict = {
        "warehouse_id": str(warehouse_id) if warehouse_id else None,
        "metrics": _pick(dashboard_service.get_kpis(db, warehouse_id, visible), input.metrics),
    }

    if warehouse_id is None and len(visible) > 1:
        warehouses = db.execute(
            select(Warehouse).where(Warehouse.id.in_(visible)).order_by(Warehouse.name)
        ).scalars()
        result["by_warehouse"] = [
            {
                "warehouse_id": str(w.id),
                "warehouse_name": w.name,
                "metrics": _pick(dashboard_service.get_kpis(db, w.id, visible), input.metrics),
            }
            for w in warehouses
        ]

    return result
