"""XGBoost — the comparison model (spec Section 1).

Tabular formulation: predict tomorrow's demand from calendar features + lagged
demand, then forecast the horizon recursively (each predicted day becomes a lag
for the next). Recursive error compounds — that's part of what the backtest is
meant to show against Prophet.
"""

import numpy as np
import pandas as pd

LAGS = (1, 7, 14)
ROLLING_WINDOWS = (7, 28)


def _feature_frame(series: pd.DataFrame) -> pd.DataFrame:
    df = series.copy()
    df["dow"] = df["ds"].dt.dayofweek
    df["dom"] = df["ds"].dt.day
    df["month"] = df["ds"].dt.month
    for lag in LAGS:
        df[f"lag_{lag}"] = df["y"].shift(lag)
    for window in ROLLING_WINDOWS:
        df[f"roll_mean_{window}"] = df["y"].shift(1).rolling(window).mean()
    return df


FEATURE_COLS = (
    ["dow", "dom", "month"]
    + [f"lag_{lag}" for lag in LAGS]
    + [f"roll_mean_{w}" for w in ROLLING_WINDOWS]
)


def fit_predict(history: pd.DataFrame, horizon_days: int) -> pd.DataFrame:
    """Same contract as prophet_model.fit_predict, minus the interval columns
    (gradient boosting gives point estimates; yhat_lower/upper come back None)."""
    from xgboost import XGBRegressor

    train = _feature_frame(history).dropna()
    if train.empty:
        raise ValueError("not enough history for XGBoost lag features")

    model = XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.9,
        objective="reg:squarederror",
        n_jobs=2,
    )
    model.fit(train[FEATURE_COLS], train["y"])

    # Recursive multi-step forecast: extend the series one day at a time.
    extended = history.copy()
    predictions: list[tuple[pd.Timestamp, float]] = []
    for step in range(1, horizon_days + 1):
        next_day = history["ds"].iloc[-1] + pd.Timedelta(days=step)
        extended = pd.concat(
            [extended, pd.DataFrame({"ds": [next_day], "y": [np.nan]})], ignore_index=True
        )
        row = _feature_frame(extended).iloc[[-1]][FEATURE_COLS]
        yhat = max(0.0, float(model.predict(row)[0]))
        extended.loc[extended.index[-1], "y"] = yhat
        predictions.append((next_day, yhat))

    out = pd.DataFrame(predictions, columns=["ds", "yhat"])
    out["yhat_lower"] = None
    out["yhat_upper"] = None
    return out
