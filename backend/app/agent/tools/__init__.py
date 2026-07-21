"""Tool registry (Section 7). The planner's execute node routes through this
dict — one entry per tool, one file per tool. Each value is (input_model, fn)."""

from app.agent.tools.inventory_query import InventoryQueryInput, inventory_query_tool
from app.agent.tools.supplier_performance import (
    SupplierPerformanceInput,
    supplier_performance_tool,
)
from app.agent.tools.forecast import ForecastToolInput, forecast_tool
from app.agent.tools.analytics_aggregation import (
    AnalyticsAggregationInput,
    analytics_aggregation_tool,
)
from app.agent.tools.outbound_status import OutboundStatusInput, outbound_status_tool
from app.agent.tools.report_synthesis import ReportSynthesisInput, report_synthesis_tool

TOOL_REGISTRY = {
    "inventory_query": (InventoryQueryInput, inventory_query_tool),
    "supplier_performance": (SupplierPerformanceInput, supplier_performance_tool),
    "forecast": (ForecastToolInput, forecast_tool),
    "analytics_aggregation": (AnalyticsAggregationInput, analytics_aggregation_tool),
    "outbound_status": (OutboundStatusInput, outbound_status_tool),
    "report_synthesis": (ReportSynthesisInput, report_synthesis_tool),
}
