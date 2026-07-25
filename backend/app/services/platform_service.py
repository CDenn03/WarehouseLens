"""Platform service — tenant CRUD and platform-admin management.

Operates in the platform pseudo-tenant context.  Platform admins cannot
touch tenant operational data — these functions only manage tenants as
administrative objects and the platform_admin role assignments.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.permissions.platform import PLATFORM_TENANT_MANAGE
from app.core.security import CurrentUser
from app.models.authorization import AccessDecision, Role, UserRole
from app.models.tenant import Tenant, User, UserTenant
from app.schemas.platform import TenantCreate, TenantRead


# ── Internal helpers ───────────────────────────────────────────────────────


def _get_platform_tenant(db: Session) -> Tenant:
    t = db.execute(
        select(Tenant).where(Tenant.is_platform.is_(True))
    ).scalar_one_or_none()
    if t is None:
        raise RuntimeError("Platform pseudo-tenant not found — run migrations")
    return t


def _log(db: Session, actor: CurrentUser, action: str, context: str) -> None:
    db.add(AccessDecision(
        user_id=actor.sub,
        permission_id=PLATFORM_TENANT_MANAGE,
        decision="allow",
        source=f"platform_service.{action}",
        action_context=context,
        created_by=actor.sub,
    ))


def _tenant_to_read(t: Tenant, db: Session) -> TenantRead:
    user_count = db.execute(
        select(UserTenant).where(UserTenant.tenant_id == t.id)
    ).all()
    return TenantRead(
        id=t.id,
        name=t.name,
        superuser_email=t.superuser_email,
        is_platform=t.is_platform,
        created_at=t.created_at,
        user_count=len(user_count),
    )


# ── Tenant CRUD ────────────────────────────────────────────────────────────


def list_tenants(db: Session) -> list[TenantRead]:
    """All non-platform tenants."""
    tenants = db.execute(
        select(Tenant)
        .where(Tenant.is_platform.is_(False))
        .order_by(Tenant.created_at)
    ).scalars().all()
    return [_tenant_to_read(t, db) for t in tenants]


def get_tenant(db: Session, tenant_id: uuid.UUID) -> TenantRead:
    t = db.get(Tenant, tenant_id)
    if t is None or t.is_platform:
        raise NotFoundError(f"tenant {tenant_id} not found")
    return _tenant_to_read(t, db)


def create_tenant(
    db: Session, actor: CurrentUser, data: TenantCreate
) -> TenantRead:
    existing = db.execute(
        select(Tenant).where(Tenant.name == data.name)
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(f"tenant with name '{data.name}' already exists")

    tenant = Tenant(
        name=data.name,
        superuser_email=data.superuser_email,
        is_platform=False,
    )
    db.add(tenant)
    db.flush()

    _log(db, actor, "create_tenant", f"tenant_name={data.name}")
    db.commit()
    return _tenant_to_read(tenant, db)


# ── Platform admin management ──────────────────────────────────────────────


def list_platform_admins(db: Session) -> list[dict]:
    """List all users who hold the platform_admin role."""
    platform_tenant = _get_platform_tenant(db)
    role = db.execute(
        select(Role).where(Role.slug == "platform_admin")
    ).scalar_one_or_none()
    if role is None:
        return []

    rows = db.execute(
        select(User, UserRole.assigned_at)
        .join(UserRole, UserRole.user_id == User.id)
        .where(
            UserRole.role_id == role.id,
            UserRole.tenant_id == platform_tenant.id,
        )
        .order_by(UserRole.assigned_at)
    ).all()

    return [
        {
            "id": row.User.id,
            "email": row.User.email,
            "username": row.User.username,
            "assigned_at": row.assigned_at,
        }
        for row in rows
    ]


def assign_platform_admin(
    db: Session, actor: CurrentUser, target_user_id: str
) -> None:
    """Grant platform_admin role to a user (they must already exist in users table)."""
    platform_tenant = _get_platform_tenant(db)

    user = db.get(User, target_user_id)
    if user is None:
        raise NotFoundError(f"user {target_user_id} not found")
    if user.deleted_at is not None:
        raise ConflictError(f"user {target_user_id} is soft-deleted")

    role = db.execute(
        select(Role).where(Role.slug == "platform_admin")
    ).scalar_one_or_none()
    if role is None:
        raise NotFoundError("platform_admin role not found — run migrations")

    # Ensure tenant membership.
    if not db.get(UserTenant, (target_user_id, platform_tenant.id)):
        db.add(UserTenant(user_id=target_user_id, tenant_id=platform_tenant.id))

    existing = db.execute(
        select(UserRole).where(
            UserRole.user_id == target_user_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == platform_tenant.id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(f"user {target_user_id} is already a platform admin")

    db.add(UserRole(
        user_id=target_user_id,
        role_id=role.id,
        tenant_id=platform_tenant.id,
        assigned_by=actor.sub,
    ))
    _log(db, actor, "assign_platform_admin", f"target={target_user_id}")
    db.commit()


def revoke_platform_admin(
    db: Session, actor: CurrentUser, target_user_id: str
) -> None:
    """Revoke platform_admin from a user. Blocks self-lockout."""
    platform_tenant = _get_platform_tenant(db)

    role = db.execute(
        select(Role).where(Role.slug == "platform_admin")
    ).scalar_one_or_none()
    if role is None:
        raise NotFoundError("platform_admin role not found")

    assignment = db.execute(
        select(UserRole).where(
            UserRole.user_id == target_user_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == platform_tenant.id,
        )
    ).scalar_one_or_none()
    if assignment is None:
        raise NotFoundError(f"user {target_user_id} does not have platform_admin role")

    # Self-lockout guard.
    other_admins = db.execute(
        select(UserRole).where(
            UserRole.role_id == role.id,
            UserRole.tenant_id == platform_tenant.id,
            UserRole.user_id != target_user_id,
        )
    ).scalars().first()
    if other_admins is None:
        raise ConflictError(
            "cannot remove the last platform admin; assign the role to another user first"
        )

    db.delete(assignment)
    _log(db, actor, "revoke_platform_admin", f"target={target_user_id}")
    db.commit()
