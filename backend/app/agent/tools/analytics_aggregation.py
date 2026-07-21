"""Analytics Aggregation tool — dashboard KPIs, optionally scoped to one
warehouse. Example: "What's our total inventory value across all warehouses?"

LEARNING AREA — scaffold.
"""

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import CurrentUser


class AnalyticsAggregationInput(BaseModel):
    warehouse_id: str | None = None  # None = all-warehouse rollup (if role allows)
    metrics: list[str] = ["total_inventory_value", "skus_below_reorder_point", "open_outbound_requests"]


def analytics_aggregation_tool(
    input: AnalyticsAggregationInput, db: Session, user: CurrentUser
) -> dict:
    """TODO(learning): thinnest tool of the five — the queries already exist.
      1. Scope check; for scoped roles with warehouse_id=None, either 403 or
         (friendlier) aggregate over just their assigned warehouses by passing
         scope_filter_warehouse_ids(db, user) as `visible`. Pick one and make the
         eval set assert it.
      2. Call dashboard_service.get_kpis(db, warehouse_id, visible) and filter to
         the requested metrics.
      3. Return {"metrics": {...}, "warehouse_id": ...}.
    The point of this tool existing separately from inventory_query: KPIs are
    pre-defined aggregates, so the planner can answer "how much is our stock
    worth" without inventing an aggregation over raw rows.
    """
    return {"metrics": {}, "note": "analytics_aggregation is a learning scaffold — not implemented"}
