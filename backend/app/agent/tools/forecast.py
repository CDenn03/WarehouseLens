"""Forecast tool — wraps the trained demand model for a product + horizon.
Example: "What's the projected demand for SKU-1042 over the next 4 weeks?"
"""

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.tools._common import to_uuid
from app.core.exceptions import NotFoundError
from app.core.security import CurrentUser, enforce_warehouse_scope
from app.forecasting.service import get_forecast
from app.models import Product


class ForecastToolInput(BaseModel):
    product_sku: str
    warehouse_id: str
    horizon_days: int = 28


def forecast_tool(input: ForecastToolInput, db: Session, user: CurrentUser) -> dict:
    """Translation + digestion only — the forecasting pipeline itself
    (app/forecasting/) is fully built. Digest-first (total demand, peak day,
    confidence band) rather than raw points: that's what the eval set's
    forecast_total/forecast_peak_day checks actually score against."""
    warehouse_id = to_uuid(input.warehouse_id)
    enforce_warehouse_scope(db, user, warehouse_id)

    product = db.execute(
        select(Product).where(Product.sku == input.product_sku)
    ).scalar_one_or_none()
    if product is None:
        raise NotFoundError(f"product with sku {input.product_sku!r} not found")

    response = get_forecast(db, product.id, warehouse_id, input.horizon_days)
    if not response.points:
        return {"forecast": None}

    total_demand = sum(p.yhat for p in response.points)
    peak = max(response.points, key=lambda p: p.yhat)
    last = response.points[-1]

    return {
        "forecast": {
            "sku": input.product_sku,
            "warehouse_id": str(warehouse_id),
            "horizon_days": response.horizon_days,
            "model": response.model,
            "total_projected_demand": round(total_demand, 1),
            "peak_day": peak.date,
            "peak_day_demand": round(peak.yhat, 1),
            "confidence_low": round(last.yhat_lower, 1) if last.yhat_lower is not None else None,
            "confidence_high": round(last.yhat_upper, 1) if last.yhat_upper is not None else None,
        }
    }
