"""Outbound Status tool — status of outbound requests, pick lists, and
shipments. Example: "What's still in picking for the Mombasa warehouse?"
"""

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.agent.tools._common import cap_rows, capped, resolve_scoped_warehouse_ids, to_uuid
from app.core.security import CurrentUser
from app.models import OutboundRequest, Product


class OutboundStatusInput(BaseModel):
    warehouse_id: str | None = None
    # Literal, not str: an unconstrained tool-calling schema lets the planner
    # LLM free-invent a plausible-but-wrong status (e.g. "in_progress" instead
    # of "picking"), silently matching zero rows instead of erroring.
    status: Literal["requested", "picking", "packed", "shipped", "delivered", "cancelled"] | None = None
    include_pick_list_detail: bool = False
    date_from: str | None = None  # ISO date; filters on created_at, inclusive
    date_to: str | None = None


def outbound_status_tool(input: OutboundStatusInput, db: Session, user: CurrentUser) -> dict:
    """Own query rather than outbound_service.list_outbound_requests: that
    service function pages through OutboundRequestRead (no shipment/pick-list
    detail) for the API's list view. This tool wants full detail and no
    pagination, so it queries OutboundRequest directly — but keeps the exact
    same source-OR-destination visibility rule (developer-guide.md §13.11) so
    an inbound transfer is visible from either warehouse side here too."""
    warehouse_id = to_uuid(input.warehouse_id)
    visible = resolve_scoped_warehouse_ids(db, user, warehouse_id)

    stmt = select(OutboundRequest)
    if warehouse_id is not None:
        stmt = stmt.where(
            or_(
                OutboundRequest.source_warehouse_id == warehouse_id,
                OutboundRequest.destination_warehouse_id == warehouse_id,
            )
        )
    else:
        stmt = stmt.where(
            or_(
                OutboundRequest.source_warehouse_id.in_(visible),
                OutboundRequest.destination_warehouse_id.in_(visible),
            )
        )
    if input.status:
        stmt = stmt.where(OutboundRequest.status == input.status)
    if input.date_from:
        stmt = stmt.where(
            OutboundRequest.created_at >= datetime.combine(date.fromisoformat(input.date_from), time.min)
        )
    if input.date_to:
        stmt = stmt.where(
            OutboundRequest.created_at <= datetime.combine(date.fromisoformat(input.date_to), time.max)
        )
    stmt = stmt.order_by(OutboundRequest.created_at.desc())

    requests, truncated = cap_rows(list(db.execute(capped(stmt)).scalars()))

    product_skus: dict = {}
    if input.include_pick_list_detail:
        referenced_ids = {
            item.product_id
            for request in requests
            for pick_list in request.pick_lists
            for item in pick_list.items
        }
        if referenced_ids:
            product_skus = {
                p.id: p.sku
                for p in db.execute(select(Product).where(Product.id.in_(referenced_ids))).scalars()
            }

    results = []
    for request in requests:
        shipment = request.shipments[-1] if request.shipments else None
        entry = {
            "id": str(request.id),
            "status": request.status,
            "is_internal_transfer": request.is_internal_transfer,
            "item_count": len(request.items),
            "created_at": request.created_at.isoformat(),
            "carrier": shipment.carrier if shipment else None,
            "tracking_number": shipment.tracking_number if shipment else None,
        }
        if input.include_pick_list_detail:
            entry["pick_list_items"] = [
                {
                    "sku": product_skus.get(item.product_id, str(item.product_id)),
                    "quantity_requested": item.quantity_requested,
                    "quantity_picked": item.quantity_picked,
                    "location": item.location,
                }
                for pick_list in request.pick_lists
                for item in pick_list.items
            ]
        results.append(entry)

    result = {"requests": results}
    if truncated:
        result["truncated"] = True
        result["note"] = (
            "Only the first 500 matching requests are shown — narrow the "
            "question (add a status, warehouse, or date range) to see the rest."
        )
    return result
