"""Prophet — the primary demand model (spec Section 1)."""

import logging

import pandas as pd

logger = logging.getLogger(__name__)

# Prophet import is deferred: it drags in cmdstan and is the slowest import in
# the codebase. API workers that never forecast shouldn't pay for it.


def fit_predict(history: pd.DataFrame, horizon_days: int) -> pd.DataFrame:
    """Fit on a (ds, y) frame, return horizon_days future rows with columns
    ds, yhat, yhat_lower, yhat_upper. Negative predictions are clipped to 0 —
    demand can't be negative, and Prophet's additive model happily goes there
    on sparse series."""
    from prophet import Prophet

    model = Prophet(
        weekly_seasonality=True,
        yearly_seasonality=len(history) >= 365,
        daily_seasonality=False,
        interval_width=0.8,
    )
    # Prophet logs a wall of cmdstan noise at INFO; keep worker logs readable.
    logging.getLogger("cmdstanpy").setLevel(logging.WARNING)
    model.fit(history)

    future = model.make_future_dataframe(periods=horizon_days, freq="D", include_history=False)
    forecast = model.predict(future)[["ds", "yhat", "yhat_lower", "yhat_upper"]]
    for col in ("yhat", "yhat_lower", "yhat_upper"):
        forecast[col] = forecast[col].clip(lower=0.0)
    return forecast
