from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.permissions.forecast import FORECAST_READ
from app.core.security import CurrentUser, enforce_warehouse_scope, require_permission
from app.forecasting.service import get_forecast
from app.schemas.agent import ForecastResponse

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("/{product_id}", response_model=ForecastResponse)
def forecast(
    product_id: UUID,
    warehouse_id: UUID = Query(),
    horizon: int | None = Query(default=None, ge=1, le=180),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(FORECAST_READ)),
):
    enforce_warehouse_scope(db, user, warehouse_id)
    horizon = horizon or get_settings().forecast_default_horizon_days
    return get_forecast(db, product_id=product_id, warehouse_id=warehouse_id, horizon_days=horizon)
