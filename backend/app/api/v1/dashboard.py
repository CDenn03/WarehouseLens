from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    CurrentUser,
    enforce_warehouse_scope,
    get_current_user,
    scope_filter_warehouse_ids,
)
from app.schemas.dashboard import AbcRankingEntry, DashboardKpis, StockTrendPoint
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# NOTE(redis): KPI/chart payloads are natural cache candidates — see the
# TODO(learning) notes in app/core/redis_client.py. Uncached on purpose for now.


@router.get("/kpis", response_model=DashboardKpis)
def kpis(
    warehouse_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if warehouse_id is not None:
        enforce_warehouse_scope(db, user, warehouse_id)
    visible = scope_filter_warehouse_ids(db, user)
    return dashboard_service.get_kpis(db, warehouse_id, visible)


@router.get("/charts/stock-trend", response_model=list[StockTrendPoint])
def stock_trend(
    warehouse_id: UUID | None = Query(default=None),
    days: int = Query(default=30, ge=2, le=365),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if warehouse_id is not None:
        enforce_warehouse_scope(db, user, warehouse_id)
    visible = scope_filter_warehouse_ids(db, user)
    return dashboard_service.stock_trend(db, warehouse_id, visible, days)


@router.get("/charts/abc-ranking", response_model=list[AbcRankingEntry])
def abc_ranking(
    warehouse_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if warehouse_id is not None:
        enforce_warehouse_scope(db, user, warehouse_id)
    visible = scope_filter_warehouse_ids(db, user)
    return dashboard_service.abc_ranking(db, warehouse_id, visible)
