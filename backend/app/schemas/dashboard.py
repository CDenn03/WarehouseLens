from datetime import date
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
