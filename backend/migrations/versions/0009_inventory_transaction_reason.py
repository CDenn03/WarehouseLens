"""Add inventory_transactions.reason.

Manual adjustments (type='adjustment') are the one place quantity_on_hand
changes with no PO or shipment behind it — reference_id has nothing to point
at, so there was no way to record *why* a correction happened. journeys.md
Journey 4 flags this as an auditability gap; this column plus the app-layer
requirement that adjustments supply a non-blank reason closes it.

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-27
"""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventory_transactions", sa.Column("reason", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("inventory_transactions", "reason")
