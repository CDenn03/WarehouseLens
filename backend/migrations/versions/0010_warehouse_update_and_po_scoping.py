"""Add warehouse.update permission; scope procurement_officer to assigned warehouses.

Two RBAC decisions from journeys.md Journeys 1 and 5:

- No endpoint existed to edit a warehouse or deactivate it (is_active was
  defined on the model but never mutated). warehouse.update fills that gap,
  granted to the two administrative roles (admin, tenant_admin) that already
  hold warehouse.create.
- procurement_officer held warehouse.global, which made it behave like
  Admin/Auditor (unscoped) rather than the warehouse-scoped role §9/§13.3
  describes. Removing it means Procurement Officers must now have a row in
  user_warehouse_assignments for any warehouse they create or receive a PO
  against, same as Warehouse Manager.

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-27
"""
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "INSERT INTO permissions (id, description, category) VALUES "
        "('warehouse.update', 'Edit or deactivate warehouses', 'warehouse') "
        "ON CONFLICT (id) DO NOTHING"
    )
    op.execute(
        "INSERT INTO role_permissions (role_id, permission_id) "
        "SELECT id, 'warehouse.update' FROM roles WHERE slug IN ('admin', 'tenant_admin') "
        "ON CONFLICT DO NOTHING"
    )
    op.execute(
        "DELETE FROM role_permissions WHERE permission_id = 'warehouse.global' "
        "AND role_id IN (SELECT id FROM roles WHERE slug = 'procurement_officer')"
    )


def downgrade() -> None:
    op.execute(
        "INSERT INTO role_permissions (role_id, permission_id) "
        "SELECT id, 'warehouse.global' FROM roles WHERE slug = 'procurement_officer' "
        "ON CONFLICT DO NOTHING"
    )
    op.execute(
        "DELETE FROM role_permissions WHERE permission_id = 'warehouse.update' "
        "AND role_id IN (SELECT id FROM roles WHERE slug IN ('admin', 'tenant_admin'))"
    )
    op.execute("DELETE FROM permissions WHERE id = 'warehouse.update'")
