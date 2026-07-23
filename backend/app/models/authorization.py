import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, UuidPkMixin


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)


class Role(Base, UuidPkMixin, CreatedAtMixin):
    __tablename__ = "roles"

    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    current_version: Mapped[int] = mapped_column(default=1)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[str] = mapped_column(
        ForeignKey("permissions.id"), primary_key=True
    )


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roles.id"), primary_key=True
    )
    assigned_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    assigned_by: Mapped[str | None] = mapped_column(String(120), nullable=True)


class AccessDecision(Base, UuidPkMixin):
    __tablename__ = "access_decisions"

    user_id: Mapped[str] = mapped_column(String(120), nullable=False)
    permission_id: Mapped[str] = mapped_column(String(120), nullable=False)
    decision: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # 'allow' or 'deny'
    source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    action_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
