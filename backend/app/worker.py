"""Background worker (Section 8) — the project's one legitimate
distributed-systems component. Runs as its own container (`python -m app.worker`)
against the same database. The API writes transactions and returns immediately;
this process catches up asynchronously.

Three jobs:
  1. Aggregate inventory_transactions into daily_warehouse_metrics (every
     aggregation tick — default 5 min; the guide says 5-15 min is plenty).
  2. Recalculate warehouse_stock.quantity_reserved from open pick lists —
     a self-healing pass in case a crash left a reservation dangling.
  3. Refresh demand forecasts (slower cadence — default hourly).

The aggregation and forecast logic here is REAL. Only the Redis coordination is
a scaffold (see app/core/redis_client.py) — with the stubbed lock, a single
worker instance behaves correctly; two replicas would double-run ticks until
the lock is actually implemented.
"""

import logging
import time
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.redis_client import redis_client
from app.forecasting.backtest import top_products
from app.forecasting.service import refresh_forecast
from app.models import (
    DailyWarehouseMetric,
    InventoryTransaction,
    PickList,
    PickListItem,
    Product,
    Warehouse,
    WarehouseStock,
)
from app.models.outbound import PickListStatus

logger = logging.getLogger("worker")

AGGREGATION_WINDOW_DAYS = 3  # re-aggregate a few trailing days each tick, so
# late-arriving transactions (clock skew, retries) still land in the right bucket


def aggregate_daily_metrics(db: Session) -> int:
    """Upsert one daily_warehouse_metrics row per (warehouse, day) in the
    trailing window. Closing position is reconstructed backwards from current
    stock, same technique as the dashboard's trend chart."""
    today = date.today()
    warehouses = list(db.execute(select(Warehouse.id)).scalars())
    rows_written = 0

    for warehouse_id in warehouses:
        current_qty = int(
            db.execute(
                select(func.coalesce(func.sum(WarehouseStock.quantity_on_hand), 0)).where(
                    WarehouseStock.warehouse_id == warehouse_id
                )
            ).scalar_one()
        )
        current_value = Decimal(
            str(
                db.execute(
                    select(
                        func.coalesce(func.sum(WarehouseStock.quantity_on_hand * Product.unit_cost), 0)
                    )
                    .join(Product, Product.id == WarehouseStock.product_id)
                    .where(WarehouseStock.warehouse_id == warehouse_id)
                ).scalar_one()
            )
        )

        # received/issued splits are computed in Python rather than SQL CASE —
        # the window is 3 days of rows, and it keeps the query dialect-portable
        day_col = func.date(InventoryTransaction.occurred_at)
        since = today - timedelta(days=AGGREGATION_WINDOW_DAYS - 1)
        txs = db.execute(
            select(day_col, InventoryTransaction.quantity_delta).where(
                InventoryTransaction.warehouse_id == warehouse_id,
                InventoryTransaction.occurred_at >= since,
            )
        ).all()

        per_day: dict[date, dict[str, int]] = {}
        for d, delta in txs:
            d = d if isinstance(d, date) else date.fromisoformat(str(d))
            bucket = per_day.setdefault(d, {"received": 0, "issued": 0, "net": 0})
            if delta > 0:
                bucket["received"] += delta
            else:
                bucket["issued"] += -delta
            bucket["net"] += delta

        # closing position per day, walking back from today's known position
        running = current_qty
        closings: dict[date, int] = {}
        for offset in range(AGGREGATION_WINDOW_DAYS):
            day = today - timedelta(days=offset)
            closings[day] = running
            running -= per_day.get(day, {}).get("net", 0)

        avg_unit_value = (current_value / current_qty) if current_qty else Decimal(0)
        for offset in range(AGGREGATION_WINDOW_DAYS):
            day = today - timedelta(days=offset)
            bucket = per_day.get(day, {"received": 0, "issued": 0, "net": 0})
            metric = db.execute(
                select(DailyWarehouseMetric).where(
                    DailyWarehouseMetric.warehouse_id == warehouse_id,
                    DailyWarehouseMetric.metric_date == day,
                )
            ).scalar_one_or_none()
            if metric is None:
                metric = DailyWarehouseMetric(warehouse_id=warehouse_id, metric_date=day)
                db.add(metric)
            metric.units_received = bucket["received"]
            metric.units_issued = bucket["issued"]
            metric.net_change = bucket["net"]
            metric.closing_quantity_on_hand = closings[day]
            metric.closing_inventory_value = (avg_unit_value * closings[day]).quantize(
                Decimal("0.01")
            )
            rows_written += 1

    db.commit()
    return rows_written


def recalculate_reservations(db: Session) -> int:
    """warehouse_stock.quantity_reserved = sum of picked quantities on COMPLETE
    pick lists whose outbound request hasn't shipped yet. Rebuilt from scratch —
    idempotent, so a crashed request path can't permanently skew reservations."""
    from app.models import OutboundRequest
    from app.models.outbound import OutboundStatus

    reserved: dict[tuple, int] = {}
    rows = db.execute(
        select(
            OutboundRequest.source_warehouse_id,
            PickListItem.product_id,
            func.sum(PickListItem.quantity_picked),
        )
        .join(PickList, PickList.id == PickListItem.pick_list_id)
        .join(OutboundRequest, OutboundRequest.id == PickList.outbound_request_id)
        .where(
            PickList.status == PickListStatus.COMPLETE,
            OutboundRequest.status == OutboundStatus.PACKED,
        )
        .group_by(OutboundRequest.source_warehouse_id, PickListItem.product_id)
    ).all()
    for warehouse_id, product_id, qty in rows:
        reserved[(warehouse_id, product_id)] = int(qty)

    changed = 0
    for stock in db.execute(select(WarehouseStock)).scalars():
        target = reserved.get((stock.warehouse_id, stock.product_id), 0)
        if stock.quantity_reserved != target:
            stock.quantity_reserved = target
            changed += 1
    db.commit()
    return changed


def refresh_forecasts(db: Session, max_series: int = 20) -> int:
    settings = get_settings()
    refreshed = 0
    for product_id, warehouse_id in top_products(db, max_series):
        try:
            refresh_forecast(db, product_id, warehouse_id, settings.forecast_default_horizon_days)
            refreshed += 1
        except Exception:
            logger.exception("forecast refresh failed for %s/%s", product_id, warehouse_id)
            db.rollback()
    return refreshed


def run_once(do_forecasts: bool) -> None:
    # TODO(learning): with a real Redis client this lock stops two worker
    # replicas double-running a tick; the stub always grants it.
    if not redis_client.acquire_lock("worker-tick", ttl_seconds=240):
        logger.info("another worker holds the lock; skipping tick")
        return
    try:
        with SessionLocal() as db:
            rows = aggregate_daily_metrics(db)
            fixes = recalculate_reservations(db)
            logger.info("aggregated %d metric rows, corrected %d reservations", rows, fixes)
            if do_forecasts:
                count = refresh_forecasts(db)
                logger.info("refreshed %d forecast series", count)
        redis_client.set("wl:worker:last_run", str(time.time()))
    finally:
        redis_client.release_lock("worker-tick")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    settings = get_settings()
    logger.info(
        "worker starting: aggregation every %ss, forecasts every %ss",
        settings.worker_aggregation_interval,
        settings.worker_forecast_interval,
    )
    last_forecast = 0.0
    while True:
        now = time.time()
        do_forecasts = now - last_forecast >= settings.worker_forecast_interval
        try:
            run_once(do_forecasts)
            if do_forecasts:
                last_forecast = now
        except Exception:
            logger.exception("worker tick failed; retrying next interval")
        time.sleep(settings.worker_aggregation_interval)


if __name__ == "__main__":
    main()
