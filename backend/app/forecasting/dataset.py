"""Builds the demand series a model trains on.

Demand = units leaving the warehouse for consumption: `issue` transactions plus
`transfer_out` (a transfer is still demand on the source warehouse's stock).
Adjustments and receipts are not demand. The series is daily, gap-filled with
zeros — Prophet handles gaps, but XGBoost's lag features do not.
"""

from datetime import date, timedelta
from uuid import UUID

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import InventoryTransaction
from app.models.inventory import TransactionType

DEMAND_TYPES = (TransactionType.ISSUE, TransactionType.TRANSFER_OUT)


def demand_series(
    db: Session,
    product_id: UUID,
    warehouse_id: UUID,
    history_days: int = 365,
) -> pd.DataFrame:
    """Daily demand as a DataFrame with columns ds (datetime) and y (float),
    zero-filled across the full window. Prophet's expected shape; XGBoost
    features derive from it."""
    since = date.today() - timedelta(days=history_days)
    day_col = func.date(InventoryTransaction.occurred_at)
    stmt = (
        select(day_col.label("day"), func.sum(-InventoryTransaction.quantity_delta).label("qty"))
        .where(
            InventoryTransaction.product_id == product_id,
            InventoryTransaction.warehouse_id == warehouse_id,
            InventoryTransaction.type.in_(DEMAND_TYPES),
            InventoryTransaction.occurred_at >= since,
        )
        .group_by(day_col)
        .order_by(day_col)
    )
    rows = db.execute(stmt).all()

    observed = {
        (d if isinstance(d, date) else date.fromisoformat(str(d))): max(0.0, float(q))
        for d, q in rows
    }
    days = pd.date_range(start=since, end=date.today(), freq="D")
    return pd.DataFrame(
        {"ds": days, "y": [observed.get(d.date(), 0.0) for d in days]}
    )
