"""add permission-based authorization tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-23

"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "permissions",
        sa.Column("id", sa.String(120), primary_key=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
    )

    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission_id", sa.String(120), sa.ForeignKey("permissions.id"), primary_key=True),
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.String(120), primary_key=True),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("assigned_by", sa.String(120), nullable=True),
    )

    op.create_table(
        "access_decisions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.String(120), nullable=False),
        sa.Column("permission_id", sa.String(120), nullable=False),
        sa.Column("decision", sa.String(10), nullable=False),
        sa.Column("source", sa.String(200), nullable=True),
        sa.Column("action_context", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_access_decisions_user_permission",
        "access_decisions",
        ["user_id", "permission_id"],
    )

    # Seed the permission catalog.
    op.execute("""
        INSERT INTO permissions (id, description, category) VALUES
        ('warehouse.create',          'Create warehouses',                     'warehouse'),
        ('warehouse.assign_user',     'Assign users to warehouses',            'warehouse'),
        ('inventory.read',            'View inventory',                        'inventory'),
        ('inventory.write',           'Create inventory transactions',         'inventory'),
        ('inventory.product.create',  'Create products',                       'inventory'),
        ('procurement.supplier.create','Create suppliers',                     'procurement'),
        ('procurement.order.create',  'Create purchase orders',                'procurement'),
        ('procurement.order.receive', 'Receive purchase orders',               'procurement'),
        ('outbound.sales_order.create','Create sales orders',                  'outbound'),
        ('outbound.transfer.create',  'Create internal transfers',             'outbound'),
        ('outbound.pick_list.manage', 'Generate and complete pick lists',      'outbound'),
        ('outbound.ship.manage',      'Ship and deliver outbound requests',    'outbound'),
        ('dashboard.read',            'View dashboard',                        'dashboard'),
        ('forecast.read',             'View forecasts',                        'forecast'),
        ('agent.invoke',              'Invoke the AI agent',                   'agent')
    ON CONFLICT (id) DO NOTHING;
    """)

    # Seed the four core roles.
    op.execute("""
        INSERT INTO roles (id, slug, name) VALUES
        ('a0000000-0000-0000-0000-000000000001', 'admin',              'Administrator'),
        ('a0000000-0000-0000-0000-000000000002', 'warehouse_manager',  'Warehouse Manager'),
        ('a0000000-0000-0000-0000-000000000003', 'procurement_officer','Procurement Officer'),
        ('a0000000-0000-0000-0000-000000000004', 'auditor',            'Auditor')
    ON CONFLICT (slug) DO NOTHING;
    """)

    # Admin gets all permissions.
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT 'a0000000-0000-0000-0000-000000000001', id FROM permissions
    """)

    # Warehouse Manager: inventory + outbound + dashboard + forecast + agent.
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT 'a0000000-0000-0000-0000-000000000002', id FROM permissions
        WHERE id IN ('inventory.read','inventory.write','inventory.product.create',
                     'outbound.sales_order.create','outbound.transfer.create',
                     'outbound.pick_list.manage','outbound.ship.manage',
                     'dashboard.read','forecast.read','agent.invoke')
    """)

    # Procurement Officer: procurement + inventory read + dashboard + forecast + agent.
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT 'a0000000-0000-0000-0000-000000000003', id FROM permissions
        WHERE id IN ('inventory.read','inventory.product.create',
                     'procurement.supplier.create','procurement.order.create',
                     'procurement.order.receive',
                     'dashboard.read','forecast.read','agent.invoke')
    """)

    # Auditor: read-only access to everything.
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT 'a0000000-0000-0000-0000-000000000004', id FROM permissions
        WHERE id IN ('inventory.read','dashboard.read','forecast.read')
    """)


def downgrade() -> None:
    op.drop_table("access_decisions")
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_table("roles")
    op.drop_table("permissions")
