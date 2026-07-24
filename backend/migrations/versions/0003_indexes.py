"""add authorization indexes

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-23

"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_user_roles_user",
        "user_roles",
        ["user_id"],
    )
    op.create_index(
        "idx_role_permissions_role",
        "role_permissions",
        ["role_id"],
    )
    op.create_index(
        "idx_access_decisions_user_time",
        "access_decisions",
        ["user_id", sa.text("decided_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_access_decisions_user_time", "access_decisions")
    op.drop_index("idx_role_permissions_role", "role_permissions")
    op.drop_index("idx_user_roles_user", "user_roles")
