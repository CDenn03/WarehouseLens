"""Platform Admin: rename iam_admin→tenant_admin, add platform pseudo-tenant,
seed platform_admin role, bootstrap first platform admin.

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-24
"""
import os

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Add is_platform column to tenants ───────────────────────────
    op.add_column(
        "tenants",
        sa.Column(
            "is_platform",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # ── 2. Rename iam_admin → tenant_admin ─────────────────────────────
    op.execute(
        sa.text(
            "UPDATE roles SET slug = 'tenant_admin', name = 'Tenant Admin' "
            "WHERE slug = 'iam_admin'"
        )
    )

    # ── 3. Add new permissions ─────────────────────────────────────────
    op.execute(
        sa.text(
            "INSERT INTO permissions (id, description, category) VALUES "
            "('dashboard.platform', "
            " 'View platform administration dashboard', 'dashboard'), "
            "('platform.tenant.manage', "
            " 'Create, list, and manage tenants on the platform', 'platform') "
            "ON CONFLICT (id) DO NOTHING"
        )
    )

    # ── 4. Seed platform_admin role ────────────────────────────────────
    op.execute(
        sa.text(
            "INSERT INTO roles (id, slug, name) VALUES "
            "('b0000000-0000-0000-0000-000000000006', "
            " 'platform_admin', 'Platform Admin') "
            "ON CONFLICT (slug) DO NOTHING"
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) VALUES "
            "('b0000000-0000-0000-0000-000000000006', 'dashboard.platform'), "
            "('b0000000-0000-0000-0000-000000000006', 'platform.tenant.manage'), "
            "('b0000000-0000-0000-0000-000000000006', 'iam.user.read') "
            "ON CONFLICT DO NOTHING"
        )
    )

    # ── 5. Seed platform pseudo-tenant ─────────────────────────────────
    op.execute(
        sa.text(
            "INSERT INTO tenants (id, name, is_platform) "
            "VALUES (gen_random_uuid(), 'platform', true)"
        )
    )

    # ── 6. Bootstrap first platform admin ─────────────────────────────
    # The placeholder user id will be replaced by upsert_user() on real login.
    # The email is what bootstrap_platform_admin() matches against.
    platform_admin_email = os.environ.get(
        "PLATFORM_ADMIN_EMAIL", "platform@warehouselens.local"
    )
    op.execute(
        sa.text(
            "INSERT INTO users (id, email, username) "
            "VALUES ('platform-admin-bootstrap', :email, 'platform-admin') "
            "ON CONFLICT (id) DO NOTHING"
        ).params(email=platform_admin_email)
    )
    op.execute(
        sa.text(
            "INSERT INTO user_tenants (user_id, tenant_id) "
            "SELECT 'platform-admin-bootstrap', id "
            "FROM tenants WHERE is_platform = true "
            "ON CONFLICT DO NOTHING"
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO user_roles (user_id, role_id, tenant_id) "
            "SELECT 'platform-admin-bootstrap', r.id, t.id "
            "FROM roles r, tenants t "
            "WHERE r.slug = 'platform_admin' AND t.is_platform = true "
            "ON CONFLICT DO NOTHING"
        )
    )

    # ── 7. Grant warehouse.create + warehouse.assign_user to tenant_admin ──
    # These were missing from iam_admin — tenant admin needs to manage warehouses.
    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id "
            "FROM roles r, permissions p "
            "WHERE r.slug = 'tenant_admin' "
            "  AND p.id IN ('warehouse.create', 'warehouse.assign_user') "
            "ON CONFLICT DO NOTHING"
        )
    )


def downgrade() -> None:
    op.execute(sa.text(
        "DELETE FROM user_roles WHERE user_id = 'platform-admin-bootstrap'"
    ))
    op.execute(sa.text(
        "DELETE FROM user_tenants WHERE user_id = 'platform-admin-bootstrap'"
    ))
    op.execute(sa.text(
        "DELETE FROM users WHERE id = 'platform-admin-bootstrap'"
    ))
    op.execute(sa.text("DELETE FROM tenants WHERE is_platform = true"))
    op.execute(sa.text(
        "DELETE FROM role_permissions "
        "WHERE role_id = 'b0000000-0000-0000-0000-000000000006' "
        "AND permission_id IN ('dashboard.platform', 'platform.tenant.manage', 'iam.user.read')"
    ))
    op.execute(sa.text("DELETE FROM roles WHERE slug = 'platform_admin'"))
    op.execute(sa.text(
        "DELETE FROM permissions WHERE id IN "
        "('dashboard.platform', 'platform.tenant.manage')"
    ))
    op.execute(sa.text(
        "UPDATE roles SET slug = 'iam_admin', name = 'IAM Admin' "
        "WHERE slug = 'tenant_admin'"
    ))
    op.execute(sa.text(
        "DELETE FROM role_permissions rp "
        "USING roles r "
        "WHERE rp.role_id = r.id AND r.slug = 'iam_admin' "
        "  AND rp.permission_id IN ('warehouse.create', 'warehouse.assign_user')"
    ))
    op.drop_column("tenants", "is_platform")
