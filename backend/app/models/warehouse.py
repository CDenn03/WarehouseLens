import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, UuidPkMixin, utcnow


class Warehouse(Base, UuidPkMixin, CreatedAtMixin):
    __tablename__ = "warehouses"

    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))


class UserWarehouseAssignment(Base):
    """Keycloak has no per-resource scoping, so warehouse assignment lives here,
    keyed off the JWT `sub` claim (Section 13.3). Only Warehouse Manager and
    Procurement Officer rows exist — Admin/Auditor are global.

    Cross-tenant guarantee: enforced at the application layer via the JOIN in
    assigned_warehouse_ids() — only warehouses whose tenant_id matches the
    caller's tenant are returned.  No DB-level FK to tenants is needed because
    a warehouse already carries tenant_id and the join is the authority.
    """

    __tablename__ = "user_warehouse_assignments"

    user_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("warehouses.id"), primary_key=True
    )
    assigned_at: Mapped[datetime] = mapped_column(default=utcnow)
