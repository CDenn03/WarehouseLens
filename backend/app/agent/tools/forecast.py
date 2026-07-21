"""Forecast tool — wraps the trained demand model for a product + horizon.
Example: "What's the projected demand for SKU-1042 over the next 4 weeks?"

LEARNING AREA — scaffold. Note the asymmetry: the forecasting PIPELINE
(app/forecasting/) is fully implemented — a normal ML task, not a learning
area. Only this agent-facing wrapper is TODO.
"""

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import CurrentUser


class ForecastToolInput(BaseModel):
    product_sku: str
    warehouse_id: str
    horizon_days: int = 28


def forecast_tool(input: ForecastToolInput, db: Session, user: CurrentUser) -> dict:
    """TODO(learning):
      1. Scope check on warehouse_id.
      2. Resolve product_sku → product_id (the planner sees SKUs in questions,
         not UUIDs — this translation is exactly the kind of glue that belongs
         in the tool, not the prompt).
      3. Call app.forecasting.service.get_forecast(db, product_id, warehouse_id,
         horizon_days) — already implemented and returns a ForecastResponse.
      4. Summarize for the LLM: total projected demand over the horizon, the
         peak day, and the confidence band — not 28 raw rows. Deciding how much
         to pre-digest vs. hand the LLM raw points is a real design choice:
         raw points let it answer follow-ups; digests keep it from arithmetic
         errors. Try both against the eval set and keep the winner.
    """
    return {"forecast": None, "note": "forecast tool is a learning scaffold — not implemented"}
