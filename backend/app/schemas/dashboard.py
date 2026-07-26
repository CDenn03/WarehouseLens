from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class DashboardKpis(BaseModel):
    total_inventory_value: Decimal
    skus_below_reorder_point: int
    open_outbound_requests: int


class StockTrendPoint(BaseModel):
    date: date
    total_quantity_on_hand: int


class AbcRankingEntry(BaseModel):
    sku: str
    name: str
    inventory_value: Decimal
    cumulative_share: float  # 0..1, cumulative share of total value
    abc_class: str  # A (top 80% of value), B (next 15%), C (last 5%)


class TenantActivityEntry(BaseModel):
    """One administrative assignment, for the tenant dashboard's activity feed."""

    kind: str  # 'role' | 'warehouse'
    user_label: str  # email, falling back to username then user id
    target: str  # role name or warehouse name
    occurred_at: datetime


class TenantDashboardSummary(BaseModel):
    user_count: int
    role_count: int  # distinct roles actually assigned within the tenant
    warehouse_count: int
    recent_activity: list[TenantActivityEntry]
