"""Add tenant scoping and IAM foundations.

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-24

ENDPOINT TENANT FILTER CHECKLIST (for PR review):
- [x] POST /warehouses — tenant_id set on create
- [x] POST /warehouses/{id}/assignments — warehouse.tenant_id checked
- [x] POST /inventory/transactions — warehouse.tenant_id checked
- [x] POST /purchase-orders — warehouse.tenant_id checked
- [x] POST /purchase-orders/{id}/receive — warehouse.tenant_id checked
- [x] POST /sales-orders — warehouse.tenant_id checked
- [x] POST /outbound-requests — warehouse.tenant_id checked
- [x] POST /outbound-requests/{id}/pick-lists — warehouse.tenant_id checked
- [x] POST /pick-lists/{id}/items/{id} — warehouse.tenant_id checked
- [x] POST /pick-lists/{id}/complete — warehouse.tenant_id checked
- [x] POST /outbound-requests/{id}/ship — warehouse.tenant_id checked
- [x] PATCH /shipments/{id}/deliver — warehouse.tenant_id checked
- [x] POST /agent/query — warehouse.tenant_id checked
- [x] GET /products — implicit via scope_filter_warehouse_ids (tenant-scoped)
- [x] GET /products/{id}/stock — implicit via scope_filter_warehouse_ids
- [x] GET /inventory/transactions — implicit via scope_filter_warehouse_ids
- [x] GET /suppliers — global catalog, no tenant filter needed
- [x] GET /purchase-orders — implicit via scope_filter_warehouse_ids
- [x] GET /outbound-requests — implicit via scope_filter_warehouse_ids
- [x] GET /outbound-requests/{id} — implicit via warehouse.tenant_id
- [x] GET /dashboard/kpis — implicit via scope_filter_warehouse_ids
- [x] GET /dashboard/charts/* — implicit via scope_filter_warehouse_ids
- [x] GET /forecast/{id} — implicit via enforce_warehouse_scope
"""
import os

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. New tables ──────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("superuser_email", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(120), primary_key=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("username", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "user_tenants",
        sa.Column("user_id", sa.String(120), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), primary_key=True),
    )

    # ── 2. Seed default tenant ─────────────────────────────────────────
    superuser_email = os.environ.get("DEFAULT_TENANT_SUPERUSER_EMAIL", "admin@warehouselens.local")
    op.execute(
        sa.text(
            "INSERT INTO tenants (id, name, superuser_email) "
            "VALUES (gen_random_uuid(), :name, :email)"
        ).params(name="default", email=superuser_email)
    )

    # ── 3. Add tenant_id to user_roles (alter composite PK) ────────────
    op.add_column("user_roles", sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=True))

    # Backfill with default tenant.
    op.execute(
        sa.text(
            "UPDATE user_roles SET tenant_id = (SELECT id FROM tenants WHERE name = 'default')"
        )
    )

    # Make NOT NULL now that backfill is complete.
    op.alter_column("user_roles", "tenant_id", nullable=False)

    # Recomposite PK: drop old PK, add new one with tenant_id.
    op.drop_constraint("user_roles_pkey", "user_roles", type_="primary")
    op.create_primary_key("user_roles_pkey", "user_roles", ["user_id", "role_id", "tenant_id"])

    # ── 4. Add tenant_id to warehouses ─────────────────────────────────
    op.add_column("warehouses", sa.Column("tenant_id", sa.Uuid(), sa.ForeignKey("tenants.id"), nullable=True))

    op.execute(
        sa.text(
            "UPDATE warehouses SET tenant_id = (SELECT id FROM tenants WHERE name = 'default')"
        )
    )

    op.alter_column("warehouses", "tenant_id", nullable=False)

    # ── 5. Add created_by to state-changing tables ─────────────────────
    for table in (
        "inventory_transactions",
        "access_decisions",
        "purchase_orders",
        "sales_orders",
        "outbound_requests",
        "pick_lists",
        "shipments",
    ):
        op.add_column(
            table,
            sa.Column("created_by", sa.String(120), sa.ForeignKey("users.id"), nullable=True),
        )

    # ── 6. New IAM permissions ─────────────────────────────────────────
    op.execute(
        sa.text(
            "INSERT INTO permissions (id, description, category) VALUES "
            "('iam.role.manage', 'Create/edit roles, assign permissions to roles', 'iam'), "
            "('iam.user_role.assign', 'Assign/revoke roles for a user within a tenant', 'iam') "
            "ON CONFLICT (id) DO NOTHING"
        )
    )

    # ── 7. iam_admin role ──────────────────────────────────────────────
    op.execute(
        sa.text(
            "INSERT INTO roles (id, slug, name) VALUES "
            "('a0000000-0000-0000-0000-000000000005', 'iam_admin', 'IAM Admin') "
            "ON CONFLICT (slug) DO NOTHING"
        )
    )

    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) VALUES "
            "('a0000000-0000-0000-0000-000000000005', 'iam.role.manage'), "
            "('a0000000-0000-0000-0000-000000000005', 'iam.user_role.assign') "
            "ON CONFLICT DO NOTHING"
        )
    )

    # ── 8. Indexes ─────────────────────────────────────────────────────
    op.create_index("idx_user_roles_tenant", "user_roles", ["tenant_id"])
    op.create_index("idx_warehouses_tenant", "warehouses", ["tenant_id"])
    op.create_index("idx_users_email", "users", ["email"])
    op.create_index("idx_user_tenants_tenant", "user_tenants", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("idx_user_tenants_tenant", "user_tenants")
    op.drop_index("idx_users_email", "users")
    op.drop_index("idx_warehouses_tenant", "warehouses")
    op.drop_index("idx_user_roles_tenant", "user_roles")

    # Remove created_by columns.
    for table in (
        "inventory_transactions",
        "access_decisions",
        "purchase_orders",
        "sales_orders",
        "outbound_requests",
        "pick_lists",
        "shipments",
    ):
        op.drop_column(table, "created_by")

    # Restore warehouses PK.
    op.drop_column("warehouses", "tenant_id")

    # Restore user_roles PK.
    op.drop_constraint("user_roles_pkey", "user_roles", type_="primary")
    op.drop_column("user_roles", "tenant_id")
    op.create_primary_key("user_roles_pkey", "user_roles", ["user_id", "role_id"])

    op.drop_table("user_tenants")
    op.drop_table("users")
    op.drop_table("tenants")
