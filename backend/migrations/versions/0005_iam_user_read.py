"""Add assigned_at to user_warehouse_assignments; seed IAM_USER_READ permission.

PR note — what assigned_warehouse_ids() pointed at before this change:
    The function queried the existing ``user_warehouse_assignments`` table
    (user_id PK + warehouse_id PK).  The cross-tenant guarantee was already
    present at the application layer: the query JOINs ``warehouses`` and
    filters ``warehouse.tenant_id == user.tenant_id``, so a stale row
    pointing to a warehouse in a different tenant is silently excluded from
    the result set.  No DB-level FK to ``tenants`` exists on this table —
    the join is the only enforcement.  This migration leaves that unchanged
    (adding a FK would require a backfill and would break the SQLite test
    suite), but the application-layer guarantee is confirmed sound.

    The only schema gap was the missing ``assigned_at`` column (useful for
    audit display and future TTL policies), which this migration adds.

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Add assigned_at to user_warehouse_assignments ──────────────
    op.add_column(
        "user_warehouse_assignments",
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # ── 2. Seed IAM_USER_READ permission ──────────────────────────────
    op.execute(
        sa.text(
            "INSERT INTO permissions (id, description, category) VALUES "
            "('iam.user.read', "
            " 'Read-only visibility into users, their roles, and warehouse assignments', "
            " 'iam') "
            "ON CONFLICT (id) DO NOTHING"
        )
    )

    # ── 3. Assign IAM_USER_READ to the iam_admin role ─────────────────
    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, 'iam.user.read' "
            "FROM roles r WHERE r.slug = 'iam_admin' "
            "ON CONFLICT DO NOTHING"
        )
    )


def downgrade() -> None:
    # Remove IAM_USER_READ from iam_admin role.
    op.execute(
        sa.text(
            "DELETE FROM role_permissions "
            "WHERE permission_id = 'iam.user.read'"
        )
    )
    op.execute(
        sa.text("DELETE FROM permissions WHERE id = 'iam.user.read'")
    )
    op.drop_column("user_warehouse_assignments", "assigned_at")
