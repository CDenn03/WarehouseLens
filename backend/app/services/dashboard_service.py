"""Dashboard KPIs and charts (3 KPIs, 2 chart types — Section 1).

Charts prefer the worker's daily_warehouse_metrics rollup when it exists and
fall back to computing from inventory_transactions directly, so the dashboard
works before the worker's first tick (and in tests).
"""

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    DailyWarehouseMetric,
    InventoryTransaction,
    OutboundRequest,
    Product,
    WarehouseStock,
)
from app.models.outbound import OutboundStatus
from app.schemas.dashboard import AbcRankingEntry, DashboardKpis, StockTrendPoint


def _stock_filter(stmt, warehouse_id: UUID | None, visible: set[UUID] | None):
    if warehouse_id is not None:
        return stmt.where(WarehouseStock.warehouse_id == warehouse_id)
    if visible is not None:
        return stmt.where(WarehouseStock.warehouse_id.in_(visible))
    return stmt


def get_kpis(
    db: Session, warehouse_id: UUID | None, visible: set[UUID] | None
) -> DashboardKpis:
    value_stmt = _stock_filter(
        select(func.coalesce(func.sum(WarehouseStock.quantity_on_hand * Product.unit_cost), 0))
        .join(Product, Product.id == WarehouseStock.product_id),
        warehouse_id,
        visible,
    )
    total_value = db.execute(value_stmt).scalar_one()

    below_stmt = _stock_filter(
        select(func.count()).select_from(WarehouseStock).where(
            WarehouseStock.quantity_on_hand < WarehouseStock.reorder_point
        ),
        warehouse_id,
        visible,
    )
    below = db.execute(below_stmt).scalar_one()

    open_stmt = select(func.count()).select_from(OutboundRequest).where(
        OutboundRequest.status.in_(OutboundStatus.OPEN)
    )
    if warehouse_id is not None:
        open_stmt = open_stmt.where(OutboundRequest.source_warehouse_id == warehouse_id)
    elif visible is not None:
        open_stmt = open_stmt.where(OutboundRequest.source_warehouse_id.in_(visible))
    open_requests = db.execute(open_stmt).scalar_one()

    return DashboardKpis(
        total_inventory_value=Decimal(total_value).quantize(Decimal("0.01")),
        skus_below_reorder_point=below,
        open_outbound_requests=open_requests,
    )


def stock_trend(
    db: Session,
    warehouse_id: UUID | None,
    visible: set[UUID] | None,
    days: int = 30,
) -> list[StockTrendPoint]:
    """Daily total on-hand for the trailing window, reconstructed by walking the
    transaction log backwards from the current position — exact by construction,
    since warehouse_stock is only ever mutated alongside a transaction row."""
    today = date.today()
    start = today - timedelta(days=days - 1)

    current_stmt = _stock_filter(
        select(func.coalesce(func.sum(WarehouseStock.quantity_on_hand), 0)),
        warehouse_id,
        visible,
    )
    current_total = int(db.execute(current_stmt).scalar_one())

    day_col = func.date(InventoryTransaction.occurred_at)
    delta_stmt = (
        select(day_col.label("day"), func.sum(InventoryTransaction.quantity_delta))
        .where(InventoryTransaction.occurred_at >= start)
        .group_by(day_col)
    )
    if warehouse_id is not None:
        delta_stmt = delta_stmt.where(InventoryTransaction.warehouse_id == warehouse_id)
    elif visible is not None:
        delta_stmt = delta_stmt.where(InventoryTransaction.warehouse_id.in_(visible))
    deltas = {
        (d if isinstance(d, date) else date.fromisoformat(str(d))): int(total)
        for d, total in db.execute(delta_stmt)
    }

    points: list[StockTrendPoint] = []
    running = current_total
    for offset in range(days):
        day = today - timedelta(days=offset)
        points.append(StockTrendPoint(date=day, total_quantity_on_hand=running))
        running -= deltas.get(day, 0)  # position at start of `day` = close of previous day
    points.reverse()
    return points


def abc_ranking(
    db: Session, warehouse_id: UUID | None, visible: set[UUID] | None
) -> list[AbcRankingEntry]:
    """Products ranked by inventory value; A = top 80% of cumulative value,
    B = next 15%, C = the tail."""
    stmt = _stock_filter(
        select(
            Product.sku,
            Product.name,
            func.sum(WarehouseStock.quantity_on_hand * Product.unit_cost).label("value"),
        )
        .join(Product, Product.id == WarehouseStock.product_id)
        .group_by(Product.id, Product.sku, Product.name)
        .order_by(func.sum(WarehouseStock.quantity_on_hand * Product.unit_cost).desc()),
        warehouse_id,
        visible,
    )
    rows = db.execute(stmt).all()
    total = sum(Decimal(str(r.value or 0)) for r in rows)
    entries: list[AbcRankingEntry] = []
    cumulative = Decimal(0)
    for sku, name, value in rows:
        value = Decimal(str(value or 0))
        # class is decided by where the item STARTS on the cumulative curve —
        # otherwise a single product worth >80% of everything would be "B"
        share_before = float(cumulative / total) if total else 0.0
        cumulative += value
        share = float(cumulative / total) if total else 0.0
        abc_class = "A" if share_before < 0.80 else "B" if share_before < 0.95 else "C"
        entries.append(
            AbcRankingEntry(
                sku=sku,
                name=name,
                inventory_value=value.quantize(Decimal("0.01")),
                cumulative_share=round(share, 4),
                abc_class=abc_class,
            )
        )
    return entries
