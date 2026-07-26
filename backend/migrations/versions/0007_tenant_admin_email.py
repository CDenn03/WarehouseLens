"""Rename tenants.superuser_email → tenants.admin_email.

The column now names the tenant's first user — the account the platform admin
provisions in Keycloak when creating the tenant — rather than an abstract
"superuser" who may never exist.

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-26
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("tenants", "superuser_email", new_column_name="admin_email")


def downgrade() -> None:
    op.alter_column("tenants", "admin_email", new_column_name="superuser_email")
