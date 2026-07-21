"""initial schema — all Section 5 tables plus the worker-owned analytics tables

Revision ID: 0001
Revises:
Create Date: 2026-07-19

"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "warehouses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("address", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sku", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("unit_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "warehouse_stock",
        sa.Column("warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), primary_key=True),
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id"), primary_key=True),
        sa.Column("quantity_on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quantity_reserved", sa.Integer(), nullable=False, server_default="0"),
        # per-warehouse threshold, deliberately NOT on products (Section 13.4)
        sa.Column("reorder_point", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "suppliers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("lead_time_days", sa.Integer(), nullable=True),
        sa.Column("contact_email", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("supplier_id", sa.Uuid(), sa.ForeignKey("suppliers.id"), nullable=False),
        sa.Column("destination_warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("expected_delivery_date", sa.Date(), nullable=True),
        sa.Column("actual_delivery_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "purchase_order_items",
        sa.Column("purchase_order_id", sa.Uuid(), sa.ForeignKey("purchase_orders.id"), primary_key=True),
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id"), primary_key=True),
        sa.Column("quantity_ordered", sa.Integer(), nullable=False),
        sa.Column("quantity_received", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "inventory_transactions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("quantity_delta", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("reference_id", sa.Uuid(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_inv_tx_wh_product_time",
        "inventory_transactions",
        ["warehouse_id", "product_id", "occurred_at"],
    )

    op.create_table(
        "sales_orders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("source_warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "sales_order_items",
        sa.Column("sales_order_id", sa.Uuid(), sa.ForeignKey("sales_orders.id"), primary_key=True),
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id"), primary_key=True),
        sa.Column("quantity_ordered", sa.Integer(), nullable=False),
    )

    op.create_table(
        "outbound_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sales_order_id", sa.Uuid(), sa.ForeignKey("sales_orders.id"), nullable=True),
        sa.Column("source_warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("destination_warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="requested"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "outbound_request_items",
        sa.Column("outbound_request_id", sa.Uuid(), sa.ForeignKey("outbound_requests.id"), primary_key=True),
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id"), primary_key=True),
        sa.Column("quantity_requested", sa.Integer(), nullable=False),
    )

    op.create_table(
        "pick_lists",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("outbound_request_id", sa.Uuid(), sa.ForeignKey("outbound_requests.id"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("assigned_to", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "pick_list_items",
        sa.Column("pick_list_id", sa.Uuid(), sa.ForeignKey("pick_lists.id"), primary_key=True),
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id"), primary_key=True),
        sa.Column("quantity_requested", sa.Integer(), nullable=False),
        sa.Column("quantity_picked", sa.Integer(), nullable=False, server_default="0"),
        # free text, e.g. "Aisle 4B" — not a bins/zones model (Section 13.2)
        sa.Column("location", sa.String(60), nullable=True),
    )

    op.create_table(
        "shipments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("outbound_request_id", sa.Uuid(), sa.ForeignKey("outbound_requests.id"), nullable=False),
        sa.Column("carrier", sa.String(100), nullable=True),
        sa.Column("tracking_number", sa.String(120), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="packed"),
        sa.Column("packed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    )

    # RBAC scoping — Keycloak `sub` → warehouse; only scoped roles appear here
    # (Section 13.3). Built in from the first migration, not retrofitted.
    op.create_table(
        "user_warehouse_assignments",
        sa.Column("user_id", sa.String(120), primary_key=True),
        sa.Column("warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), primary_key=True),
    )

    # Worker-owned tables (Section 8)
    op.create_table(
        "daily_warehouse_metrics",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column("units_received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("units_issued", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("net_change", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("closing_quantity_on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("closing_inventory_value", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("warehouse_id", "metric_date"),
    )

    op.create_table(
        "forecast_results",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("warehouse_id", sa.Uuid(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("model", sa.String(30), nullable=False),
        sa.Column("forecast_date", sa.Date(), nullable=False),
        sa.Column("yhat", sa.Numeric(12, 2), nullable=False),
        sa.Column("yhat_lower", sa.Numeric(12, 2), nullable=True),
        sa.Column("yhat_upper", sa.Numeric(12, 2), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    for table in (
        "forecast_results",
        "daily_warehouse_metrics",
        "user_warehouse_assignments",
        "shipments",
        "pick_list_items",
        "pick_lists",
        "outbound_request_items",
        "outbound_requests",
        "sales_order_items",
        "sales_orders",
        "inventory_transactions",
        "purchase_order_items",
        "purchase_orders",
        "suppliers",
        "warehouse_stock",
        "products",
        "warehouses",
    ):
        op.drop_table(table)
