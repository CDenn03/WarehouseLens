import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, UuidPkMixin, utcnow


class Tenant(Base, UuidPkMixin, CreatedAtMixin):
    """Top-level organisational boundary.  A second tenant can be added by
    inserting a row — no retrofitting of queries required (single-tenant now,
    multi-tenant ready).

    ``is_platform=True`` marks the single platform pseudo-tenant.  It owns
    the platform_admin role assignments and has no warehouses or operational
    data.  Tenant-listing queries use ``WHERE is_platform = false`` to exclude
    it from the real-tenant list.
    """

    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(Text, nullable=False)
    # The tenant's first user: provisioned in Keycloak as a tenant_admin when
    # the tenant is created, and the email the legacy login bootstrap matches on.
    admin_email: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_platform: Mapped[bool] = mapped_column(default=False)


class User(Base):
    """Identity record mirrored from Keycloak.  The ``id`` is the Keycloak
    ``sub`` claim (never regenerated).  Soft-deleted users have ``deleted_at``
    set; they cannot authenticate but their ``created_by`` references still
    resolve."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class UserTenant(Base):
    """Maps a user to one or more tenants.  The composite PK prevents
    duplicate assignments."""

    __tablename__ = "user_tenants"

    user_id: Mapped[str] = mapped_column(
        String(120), ForeignKey("users.id"), primary_key=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id"), primary_key=True
    )
