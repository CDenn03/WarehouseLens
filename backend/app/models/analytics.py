"""Worker-owned tables (Section 8): the aggregation target for
inventory_transactions and the persisted forecast output. Not part of the core
Section 5 schema — the API only ever reads these; the worker writes them."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UuidPkMixin, utcnow


class DailyWarehouseMetric(Base, UuidPkMixin):
    """One row per warehouse per day: rolled-up movement + end-of-day position.
    Feeds the dashboard's stock-trend chart without scanning the transaction log
    on every request."""

    __tablename__ = "daily_warehouse_metrics"
    __table_args__ = (UniqueConstraint("warehouse_id", "metric_date"),)

    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"))
    metric_date: Mapped[date] = mapped_column(Date)
    units_received: Mapped[int] = mapped_column(default=0)
    units_issued: Mapped[int] = mapped_column(default=0)
    net_change: Mapped[int] = mapped_column(default=0)
    closing_quantity_on_hand: Mapped[int] = mapped_column(default=0)
    closing_inventory_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    computed_at: Mapped[datetime] = mapped_column(default=utcnow)


class ForecastResult(Base, UuidPkMixin):
    """Persisted output of the forecast refresh. GET /forecast reads the latest
    row set for (product, warehouse, model); the worker replaces them on refresh."""

    __tablename__ = "forecast_results"

    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("warehouses.id"))
    model: Mapped[str] = mapped_column(String(30))  # prophet | xgboost
    forecast_date: Mapped[date] = mapped_column(Date)
    yhat: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    yhat_lower: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    yhat_upper: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    generated_at: Mapped[datetime] = mapped_column(default=utcnow)
