"""Supplier Performance tool — lead time / on-time delivery stats from PO
history. Example: "Which supplier has the most delivery delays this quarter?"

LEARNING AREA — scaffold.
"""

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import CurrentUser


class SupplierPerformanceInput(BaseModel):
    supplier_name: str | None = None  # None = rank all suppliers
    warehouse_id: str | None = None  # limit to POs destined for one warehouse
    date_from: str | None = None  # ISO date; None = all history
    date_to: str | None = None


def supplier_performance_tool(
    input: SupplierPerformanceInput, db: Session, user: CurrentUser
) -> dict:
    """TODO(learning): fixed parameterized query over purchase_orders:
      1. Scope check on warehouse_id (as in inventory_query).
      2. For POs with status='received' in the window: per supplier compute
         - avg actual lead time: AVG(actual_delivery_date - order_date)
         - on-time rate: share where actual_delivery_date <= expected_delivery_date
         - avg delay days on late ones
         GROUP BY supplier, ORDER BY on-time rate ascending (worst first).
      3. Compare against suppliers.lead_time_days (the promised figure) so the
         answer can say "promises 5 days, averages 9".
      Return {"suppliers": [{name, po_count, avg_lead_time_days,
      promised_lead_time_days, on_time_rate, avg_delay_days}, ...]}.
    Seed data deliberately includes one supplier with a bad record (Section 12),
    so an empty-looking result here means a bug, not clean data.
    """
    return {"suppliers": [], "note": "supplier_performance is a learning scaffold — not implemented"}
