"""Report Synthesis tool (stretch) — combines other tools into a narrative
summary. Example: "Summarize this week's warehouse performance."
"""

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agent.tools.analytics_aggregation import (
    AnalyticsAggregationInput,
    analytics_aggregation_tool,
)
from app.agent.tools.outbound_status import OutboundStatusInput, outbound_status_tool
from app.core.security import CurrentUser


class ReportSynthesisInput(BaseModel):
    warehouse_id: str | None = None
    period_days: int = 7


def report_synthesis_tool(input: ReportSynthesisInput, db: Session, user: CurrentUser) -> dict:
    """Tool-calls-tools (agent-core-spec.md §2.3) — deterministic, no extra LLM
    round-trips, and it's honest about which sections a "report" has rather
    than leaving that to a planner loop. Every sub-call gets the same user and
    goes through the same scope checks as if called directly."""
    kpis = analytics_aggregation_tool(
        AnalyticsAggregationInput(warehouse_id=input.warehouse_id), db, user
    )
    outbound = outbound_status_tool(
        OutboundStatusInput(warehouse_id=input.warehouse_id), db, user
    )
    return {
        "sections": [
            {"title": "Inventory KPIs", "data": kpis},
            {"title": "Outbound Activity", "data": outbound},
        ]
    }
