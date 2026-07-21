"""Outbound Status tool (new in this design) — status of outbound requests,
pick lists, and shipments. Example: "What's still in picking for Mombasa?"

LEARNING AREA — scaffold.
"""

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import CurrentUser


class OutboundStatusInput(BaseModel):
    warehouse_id: str | None = None
    status: str | None = None  # requested | picking | packed | shipped | delivered | cancelled
    include_pick_list_detail: bool = False


def outbound_status_tool(input: OutboundStatusInput, db: Session, user: CurrentUser) -> dict:
    """TODO(learning):
      1. Scope check on warehouse_id (source warehouse of the requests).
      2. outbound_service.list_outbound_requests already implements the fixed
         query — reuse it. For each request return: id, status, internal vs
         external (destination_warehouse_id is NULL = external), item count,
         created_at, and carrier/tracking from the shipment when one exists.
      3. If include_pick_list_detail: add per-line picked-vs-requested and the
         free-text `location` (Section 13.2) — this is what lets the agent
         answer "where do I find the items still to pick?".
    Seed data guarantees one request in each status (Section 12), so every
    status filter has a non-empty gold answer in the eval set.
    """
    return {"requests": [], "note": "outbound_status is a learning scaffold — not implemented"}
