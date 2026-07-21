"""Serving layer for GET /forecast and the worker's refresh job.

Reads the worker's persisted ForecastResult rows when fresh ones exist;
otherwise fits Prophet on demand and persists the result (so the first request
for a product pays the fit cost once, not every time)."""

import logging
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.forecasting import prophet_model
from app.forecasting.dataset import demand_series
from app.models import ForecastResult, Product, Warehouse
from app.schemas.agent import ForecastPoint, ForecastResponse

logger = logging.getLogger(__name__)

MIN_HISTORY_DAYS = 30  # below this, fall back to a trailing mean


def get_forecast(
    db: Session, product_id: UUID, warehouse_id: UUID, horizon_days: int
) -> ForecastResponse:
    if db.get(Product, product_id) is None:
        raise NotFoundError(f"product {product_id} not found")
    if db.get(Warehouse, warehouse_id) is None:
        raise NotFoundError(f"warehouse {warehouse_id} not found")

    stored = _stored_points(db, product_id, warehouse_id, horizon_days)
    if stored is not None:
        model_name, points = stored
    else:
        model_name, points = refresh_forecast(db, product_id, warehouse_id, horizon_days)

    return ForecastResponse(
        product_id=product_id,
        warehouse_id=warehouse_id,
        horizon_days=horizon_days,
        model=model_name,
        points=points[:horizon_days],
    )


def _stored_points(
    db: Session, product_id: UUID, warehouse_id: UUID, horizon_days: int
) -> tuple[str, list[ForecastPoint]] | None:
    rows = list(
        db.execute(
            select(ForecastResult)
            .where(
                ForecastResult.product_id == product_id,
                ForecastResult.warehouse_id == warehouse_id,
                ForecastResult.forecast_date >= date.today(),
            )
            .order_by(ForecastResult.forecast_date)
        ).scalars()
    )
    if len(rows) < horizon_days:
        return None
    points = [
        ForecastPoint(
            date=r.forecast_date.isoformat(),
            yhat=float(r.yhat),
            yhat_lower=float(r.yhat_lower) if r.yhat_lower is not None else None,
            yhat_upper=float(r.yhat_upper) if r.yhat_upper is not None else None,
        )
        for r in rows
    ]
    return rows[0].model, points


def refresh_forecast(
    db: Session, product_id: UUID, warehouse_id: UUID, horizon_days: int
) -> tuple[str, list[ForecastPoint]]:
    """Fit, persist (replacing prior rows for this series), and return points.
    Called by the worker on its forecast cadence and lazily by get_forecast."""
    series = demand_series(db, product_id, warehouse_id)
    nonzero_days = int((series["y"] > 0).sum())

    if nonzero_days >= MIN_HISTORY_DAYS:
        try:
            frame = prophet_model.fit_predict(series, horizon_days)
            model_name = "prophet"
        except Exception as exc:
            logger.warning("prophet failed for %s/%s (%s); using naive", product_id, warehouse_id, exc)
            frame, model_name = _naive_frame(series, horizon_days), "naive"
    else:
        frame, model_name = _naive_frame(series, horizon_days), "naive"

    db.execute(
        delete(ForecastResult).where(
            ForecastResult.product_id == product_id,
            ForecastResult.warehouse_id == warehouse_id,
        )
    )
    points: list[ForecastPoint] = []
    for _, row in frame.iterrows():
        forecast_date = row["ds"].date()
        db.add(
            ForecastResult(
                product_id=product_id,
                warehouse_id=warehouse_id,
                model=model_name,
                forecast_date=forecast_date,
                yhat=Decimal(str(round(float(row["yhat"]), 2))),
                yhat_lower=_dec(row["yhat_lower"]),
                yhat_upper=_dec(row["yhat_upper"]),
            )
        )
        points.append(
            ForecastPoint(
                date=forecast_date.isoformat(),
                yhat=round(float(row["yhat"]), 2),
                yhat_lower=_float(row["yhat_lower"]),
                yhat_upper=_float(row["yhat_upper"]),
            )
        )
    db.commit()
    return model_name, points


def _naive_frame(series, horizon_days: int):
    import pandas as pd

    mean = float(series["y"].tail(28).mean()) if len(series) else 0.0
    days = pd.date_range(start=pd.Timestamp(date.today()) + pd.Timedelta(days=1), periods=horizon_days)
    return pd.DataFrame(
        {"ds": days, "yhat": [mean] * horizon_days, "yhat_lower": [None] * horizon_days, "yhat_upper": [None] * horizon_days}
    )


def _dec(value) -> Decimal | None:
    return None if value is None or (isinstance(value, float) and value != value) else Decimal(str(round(float(value), 2)))


def _float(value) -> float | None:
    return None if value is None or (isinstance(value, float) and value != value) else round(float(value), 2)
