"""Supplier Performance tool — lead time / on-time delivery stats from PO
history. Example: "Which supplier has the most delivery delays this quarter?"
"""

from datetime import date

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.tools._common import resolve_scoped_warehouse_ids, to_uuid
from app.core.security import CurrentUser
from app.models import PurchaseOrder, Supplier
from app.models.procurement import POStatus


class SupplierPerformanceInput(BaseModel):
    supplier_name: str | None = None  # None = rank all suppliers
    warehouse_id: str | None = None  # limit to POs destined for one warehouse
    date_from: str | None = None  # ISO date; None = all history
    date_to: str | None = None


def supplier_performance_tool(
    input: SupplierPerformanceInput, db: Session, user: CurrentUser
) -> dict:
    """Own query — fixed aggregation over received purchase orders. Note
    eval/run_eval.py's gold computation (``_supplier_stats``) implements this
    same aggregation independently, as a cross-check; it isn't imported here on
    purpose (agreeing with your own code isn't a test)."""
    warehouse_id = to_uuid(input.warehouse_id)
    visible = resolve_scoped_warehouse_ids(db, user, warehouse_id)

    stmt = (
        select(Supplier, PurchaseOrder)
        .join(PurchaseOrder, PurchaseOrder.supplier_id == Supplier.id)
        .where(
            PurchaseOrder.status == POStatus.RECEIVED,
            PurchaseOrder.actual_delivery_date.is_not(None),
            PurchaseOrder.destination_warehouse_id.in_(visible),
        )
    )
    if input.supplier_name:
        stmt = stmt.where(Supplier.name == input.supplier_name)
    if input.date_from:
        stmt = stmt.where(PurchaseOrder.order_date >= date.fromisoformat(input.date_from))
    if input.date_to:
        stmt = stmt.where(PurchaseOrder.order_date <= date.fromisoformat(input.date_to))

    stats: dict[str, dict] = {}
    for supplier, po in db.execute(stmt).all():
        s = stats.setdefault(
            supplier.name,
            {
                "po_count": 0,
                "on_time": 0,
                "delays": [],
                "lead_times": [],
                "promised_lead_time_days": supplier.lead_time_days,
            },
        )
        s["po_count"] += 1
        s["lead_times"].append((po.actual_delivery_date - po.order_date).days)
        if po.expected_delivery_date:
            delay = (po.actual_delivery_date - po.expected_delivery_date).days
            if delay <= 0:
                s["on_time"] += 1
            else:
                s["delays"].append(delay)

    suppliers = []
    for name, s in stats.items():
        on_time_rate = s["on_time"] / s["po_count"] if s["po_count"] else None
        avg_lead_time = sum(s["lead_times"]) / len(s["lead_times"]) if s["lead_times"] else None
        avg_delay = sum(s["delays"]) / len(s["delays"]) if s["delays"] else 0.0
        suppliers.append(
            {
                "name": name,
                "po_count": s["po_count"],
                "avg_lead_time_days": round(avg_lead_time, 1) if avg_lead_time is not None else None,
                "promised_lead_time_days": s["promised_lead_time_days"],
                "on_time_rate_percent": round(on_time_rate * 100) if on_time_rate is not None else None,
                "avg_delay_days": round(avg_delay, 1),
                "late_po_count": len(s["delays"]),
            }
        )
    suppliers.sort(
        key=lambda s: s["on_time_rate_percent"] if s["on_time_rate_percent"] is not None else 100
    )
    return {"suppliers": suppliers}
