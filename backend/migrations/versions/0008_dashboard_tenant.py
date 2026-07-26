"""Add the dashboard.tenant permission and grant it to tenant_admin.

Dashboard routing is driven by the dashboard.* permission namespace rather than
by role slug, so the tenant administration landing page needs its own
permission.  Granting it to tenant_admin is what moves that role off the
operational dashboard — which it could never read anyway, since it holds no
inventory permissions.

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-26
"""
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "INSERT INTO permissions (id, description, category) VALUES "
        "('dashboard.tenant', 'View tenant administration dashboard', 'dashboard') "
        "ON CONFLICT (id) DO NOTHING"
    )
    op.execute(
        "INSERT INTO role_permissions (role_id, permission_id) "
        "SELECT id, 'dashboard.tenant' FROM roles WHERE slug = 'tenant_admin' "
        "ON CONFLICT DO NOTHING"
    )


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions WHERE permission_id = 'dashboard.tenant'")
    op.execute("DELETE FROM permissions WHERE id = 'dashboard.tenant'")
