"""Rolling-origin backtest: Prophet vs XGBoost vs a naive baseline
(28-day trailing mean). Run it as a script against seeded data:

    python -m app.forecasting.backtest [--folds 4] [--horizon 14]

For each fold, train on everything before the cutoff, forecast `horizon` days,
score against what actually happened. The naive baseline is the honesty check —
a fancy model that can't beat "last month's average" hasn't earned its place.
"""

import argparse
import logging
from dataclasses import dataclass
from uuid import UUID

import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.forecasting import prophet_model, xgboost_model
from app.forecasting.dataset import DEMAND_TYPES, demand_series
from app.models import InventoryTransaction

logger = logging.getLogger(__name__)


@dataclass
class FoldScore:
    model: str
    fold: int
    mae: float
    mape: float | None  # None when actuals are all zero in the window


def _score(actual: np.ndarray, predicted: np.ndarray) -> tuple[float, float | None]:
    mae = float(np.mean(np.abs(actual - predicted)))
    nonzero = actual != 0
    mape = float(np.mean(np.abs((actual[nonzero] - predicted[nonzero]) / actual[nonzero]))) if nonzero.any() else None
    return mae, mape


def _naive_predict(train: pd.DataFrame, horizon: int) -> np.ndarray:
    return np.full(horizon, float(train["y"].tail(28).mean()))


def backtest_series(series: pd.DataFrame, folds: int, horizon: int) -> list[FoldScore]:
    scores: list[FoldScore] = []
    n = len(series)
    for fold in range(folds):
        cutoff = n - horizon * (folds - fold)
        if cutoff < 60:  # not enough training history for this fold
            continue
        train = series.iloc[:cutoff].reset_index(drop=True)
        test = series.iloc[cutoff : cutoff + horizon].reset_index(drop=True)
        actual = test["y"].to_numpy()

        candidates = {
            "naive": lambda: _naive_predict(train, len(test)),
            "prophet": lambda: prophet_model.fit_predict(train, len(test))["yhat"].to_numpy(),
            "xgboost": lambda: xgboost_model.fit_predict(train, len(test))["yhat"].to_numpy(),
        }
        for name, run in candidates.items():
            try:
                mae, mape = _score(actual, run())
                scores.append(FoldScore(model=name, fold=fold, mae=mae, mape=mape))
            except Exception as exc:  # a model failing a fold is a result, not a crash
                logger.warning("%s failed fold %d: %s", name, fold, exc)
    return scores


def summarize(scores: list[FoldScore]) -> pd.DataFrame:
    frame = pd.DataFrame([s.__dict__ for s in scores])
    if frame.empty:
        return frame
    return frame.groupby("model").agg(
        folds=("fold", "count"), mean_mae=("mae", "mean"), mean_mape=("mape", "mean")
    )


def top_products(db: Session, limit: int) -> list[tuple[UUID, UUID]]:
    """(product_id, warehouse_id) pairs with the most demand history."""
    stmt = (
        select(InventoryTransaction.product_id, InventoryTransaction.warehouse_id)
        .where(InventoryTransaction.type.in_(DEMAND_TYPES))
        .group_by(InventoryTransaction.product_id, InventoryTransaction.warehouse_id)
        .order_by(func.count().desc())
        .limit(limit)
    )
    return [(p, w) for p, w in db.execute(stmt)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--folds", type=int, default=4)
    parser.add_argument("--horizon", type=int, default=14)
    parser.add_argument("--products", type=int, default=5, help="top-N series by history")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    from app.core.database import SessionLocal

    with SessionLocal() as db:
        pairs = top_products(db, args.products)
        if not pairs:
            raise SystemExit("no demand history — run data/generate_seed_data.py first")
        all_scores: list[FoldScore] = []
        for product_id, warehouse_id in pairs:
            series = demand_series(db, product_id, warehouse_id)
            all_scores.extend(backtest_series(series, args.folds, args.horizon))
        print(summarize(all_scores).to_string())


if __name__ == "__main__":
    main()
