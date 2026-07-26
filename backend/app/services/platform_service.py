"""Platform service — tenant CRUD and platform-admin management.

Operates in the platform pseudo-tenant context.  Platform admins cannot touch
tenant operational data — these functions only manage tenants as administrative
objects, the accounts that administer them, and platform_admin role assignments.

Provisioning model: creating a tenant creates its first user.  The address in
``admin_email`` gets a Keycloak account (temporary password, UPDATE_PASSWORD
required action), a local ``users`` row keyed by the Keycloak sub, membership in
the new tenant, and the ``tenant_admin`` role.  Nothing is left to the
first-login bootstrap, which stays only for the seeded default tenant.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import keycloak_admin
from app.core.exceptions import ConflictError, NotFoundError
from app.core.permissions.platform import PLATFORM_TENANT_MANAGE
from app.core.security import CurrentUser
from app.models.authorization import AccessDecision, Role, UserRole
from app.models.tenant import Tenant, User, UserTenant
from app.models.warehouse import Warehouse
from app.schemas.platform import (
    PlatformAdminCreate,
    PlatformAdminRead,
    PlatformAdminUpdate,
    PlatformAdminWithCredentialRead,
    ProvisionedAdminRead,
    TenantCreate,
    TenantRead,
    TenantUpdate,
    TenantWithAdminRead,
)

logger = logging.getLogger(__name__)

TENANT_ADMIN_ROLE = "tenant_admin"
PLATFORM_ADMIN_ROLE = "platform_admin"


# ── Internal helpers ───────────────────────────────────────────────────────


def _get_platform_tenant(db: Session) -> Tenant:
    t = db.execute(
        select(Tenant).where(Tenant.is_platform.is_(True))
    ).scalar_one_or_none()
    if t is None:
        raise RuntimeError("Platform pseudo-tenant not found — run migrations")
    return t


def _get_role(db: Session, slug: str) -> Role:
    role = db.execute(select(Role).where(Role.slug == slug)).scalar_one_or_none()
    if role is None:
        raise NotFoundError(f"role '{slug}' not found — run migrations")
    return role


def _log(db: Session, actor: CurrentUser, action: str, context: str) -> None:
    db.add(AccessDecision(
        user_id=actor.sub,
        permission_id=PLATFORM_TENANT_MANAGE,
        decision="allow",
        source=f"platform_service.{action}",
        action_context=context,
        created_by=actor.sub,
    ))


def _get_real_tenant(db: Session, tenant_id: uuid.UUID) -> Tenant:
    """Fetch a tenant, refusing to expose the platform pseudo-tenant as one."""
    t = db.get(Tenant, tenant_id)
    if t is None or t.is_platform:
        raise NotFoundError(f"tenant {tenant_id} not found")
    return t


def _count(db: Session, stmt) -> int:
    return db.execute(stmt).scalar_one()


def _tenant_admin_user_id(db: Session, tenant: Tenant) -> str | None:
    """The local user id of the tenant's admin, matched on ``admin_email``."""
    if not tenant.admin_email:
        return None
    return db.execute(
        select(User.id)
        .join(UserTenant, UserTenant.user_id == User.id)
        .where(
            UserTenant.tenant_id == tenant.id,
            func.lower(User.email) == tenant.admin_email.lower(),
        )
    ).scalars().first()


def _tenant_to_read(db: Session, t: Tenant) -> TenantRead:
    user_count = _count(
        db,
        select(func.count()).select_from(UserTenant).where(UserTenant.tenant_id == t.id),
    )
    warehouse_count = _count(
        db,
        select(func.count()).select_from(Warehouse).where(Warehouse.tenant_id == t.id),
    )
    return TenantRead(
        id=t.id,
        name=t.name,
        admin_email=t.admin_email,
        is_platform=t.is_platform,
        created_at=t.created_at,
        user_count=user_count,
        warehouse_count=warehouse_count,
        admin_user_id=_tenant_admin_user_id(db, t),
    )


def _assert_name_available(
    db: Session, name: str, *, exclude_id: uuid.UUID | None = None
) -> None:
    stmt = select(Tenant).where(func.lower(Tenant.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(Tenant.id != exclude_id)
    if db.execute(stmt).scalar_one_or_none() is not None:
        raise ConflictError(f"tenant with name '{name}' already exists")


def _upsert_local_user(
    db: Session, user_id: str, email: str, username: str | None
) -> User:
    """Mirror a Keycloak account into ``users``, reviving a soft-deleted row.

    The primary key is the Keycloak sub, so a provisioned user is already
    reconciled with whatever the JWT will carry at their first login.
    """
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=email, username=username)
        db.add(user)
    else:
        user.email = email
        if username:
            user.username = username
        user.deleted_at = None
    db.flush()
    return user


def _grant_role(
    db: Session,
    *,
    user_id: str,
    role: Role,
    tenant_id: uuid.UUID,
    assigned_by: str,
) -> bool:
    """Ensure membership + role assignment.  Returns False if already held."""
    if db.get(UserTenant, (user_id, tenant_id)) is None:
        db.add(UserTenant(user_id=user_id, tenant_id=tenant_id))

    existing = db.execute(
        select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return False

    db.add(UserRole(
        user_id=user_id,
        role_id=role.id,
        tenant_id=tenant_id,
        assigned_by=assigned_by,
    ))
    db.flush()
    return True


def _provision_admin(
    db: Session,
    *,
    email: str,
    username: str | None,
    role_slug: str,
    tenant_id: uuid.UUID,
    actor: CurrentUser,
) -> ProvisionedAdminRead:
    """Create (or reuse) the Keycloak account for ``email`` and give it
    ``role_slug`` in ``tenant_id``.

    Keycloak is called before any local write is committed: if provisioning
    fails the caller gets a 502 and no half-provisioned tenant is left behind.
    """
    result = keycloak_admin.provision_user(email, username=username)
    role = _get_role(db, role_slug)

    _upsert_local_user(
        db,
        result.user.id,
        result.user.email or email,
        result.user.username or username,
    )
    _grant_role(
        db,
        user_id=result.user.id,
        role=role,
        tenant_id=tenant_id,
        assigned_by=actor.sub,
    )

    return ProvisionedAdminRead(
        user_id=result.user.id,
        email=result.user.email or email,
        username=result.user.username or username,
        created=result.created,
        temporary_password=result.temporary_password,
    )


# ── Tenant CRUD ────────────────────────────────────────────────────────────


def list_tenants(db: Session) -> list[TenantRead]:
    """All non-platform tenants."""
    tenants = db.execute(
        select(Tenant)
        .where(Tenant.is_platform.is_(False))
        .order_by(Tenant.created_at)
    ).scalars().all()
    return [_tenant_to_read(db, t) for t in tenants]


def get_tenant(db: Session, tenant_id: uuid.UUID) -> TenantRead:
    return _tenant_to_read(db, _get_real_tenant(db, tenant_id))


def create_tenant(
    db: Session, actor: CurrentUser, data: TenantCreate
) -> TenantWithAdminRead:
    """Create a tenant and provision its first user as tenant_admin."""
    _assert_name_available(db, data.name)

    tenant = Tenant(name=data.name, admin_email=data.admin_email, is_platform=False)
    db.add(tenant)
    db.flush()

    admin = _provision_admin(
        db,
        email=data.admin_email,
        username=None,
        role_slug=TENANT_ADMIN_ROLE,
        tenant_id=tenant.id,
        actor=actor,
    )

    _log(
        db,
        actor,
        "create_tenant",
        f"tenant_name={data.name} admin_email={data.admin_email}",
    )
    db.commit()
    return TenantWithAdminRead(tenant=_tenant_to_read(db, tenant), admin=admin)


def update_tenant(
    db: Session, actor: CurrentUser, tenant_id: uuid.UUID, data: TenantUpdate
) -> TenantWithAdminRead:
    """Rename a tenant and/or hand it a new admin.

    Changing ``admin_email`` provisions the new address as an additional
    tenant_admin; the previous admin keeps their access so a mistyped address
    cannot lock the tenant out.  Remove the old one from the tenant's IAM screen.
    """
    tenant = _get_real_tenant(db, tenant_id)
    admin: ProvisionedAdminRead | None = None

    if data.name is not None and data.name != tenant.name:
        _assert_name_available(db, data.name, exclude_id=tenant.id)
        tenant.name = data.name

    if data.admin_email is not None and data.admin_email != (tenant.admin_email or ""):
        admin = _provision_admin(
            db,
            email=data.admin_email,
            username=None,
            role_slug=TENANT_ADMIN_ROLE,
            tenant_id=tenant.id,
            actor=actor,
        )
        tenant.admin_email = data.admin_email

    _log(db, actor, "update_tenant", f"tenant_id={tenant_id}")
    db.commit()
    return TenantWithAdminRead(tenant=_tenant_to_read(db, tenant), admin=admin)


def delete_tenant(db: Session, actor: CurrentUser, tenant_id: uuid.UUID) -> None:
    """Delete a tenant, its memberships and its role assignments.

    Refuses while the tenant still owns warehouses: everything operational hangs
    off a warehouse, and deleting the tenant row out from under that data would
    orphan it silently.  Users left without any tenant are soft-deleted locally
    and disabled in Keycloak — disabled rather than deleted so their ``sub``
    keeps resolving in audit history.
    """
    tenant = _get_real_tenant(db, tenant_id)
    tenant_name = tenant.name

    warehouse_count = _count(
        db,
        select(func.count()).select_from(Warehouse).where(Warehouse.tenant_id == tenant.id),
    )
    if warehouse_count:
        raise ConflictError(
            f"tenant '{tenant_name}' still has {warehouse_count} warehouse(s); "
            "delete or reassign them before deleting the tenant"
        )

    member_ids = db.execute(
        select(UserTenant.user_id).where(UserTenant.tenant_id == tenant.id)
    ).scalars().all()

    db.execute(UserRole.__table__.delete().where(UserRole.tenant_id == tenant.id))
    db.execute(UserTenant.__table__.delete().where(UserTenant.tenant_id == tenant.id))
    db.flush()

    orphans = [
        user_id
        for user_id in member_ids
        if _count(
            db,
            select(func.count()).select_from(UserTenant).where(
                UserTenant.user_id == user_id
            ),
        ) == 0
    ]
    for user_id in orphans:
        user = db.get(User, user_id)
        if user is not None:
            user.deleted_at = datetime.now(timezone.utc)
        _disable_keycloak_user(user_id)

    db.delete(tenant)
    _log(db, actor, "delete_tenant", f"tenant_id={tenant_id} name={tenant_name}")
    db.commit()


def _disable_keycloak_user(user_id: str) -> None:
    """Best-effort Keycloak deactivation.

    The local delete has already been decided; a Keycloak outage must not roll it
    back, so the failure is logged for an operator to reconcile instead of raised.
    """
    try:
        keycloak_admin.set_enabled(user_id, False)
    except Exception:  # deliberately non-fatal — see docstring
        logger.warning(
            "could not disable Keycloak account %s after tenant deletion", user_id,
            exc_info=True,
        )


def reset_tenant_admin_password(
    db: Session, actor: CurrentUser, tenant_id: uuid.UUID
) -> tuple[str, str, str]:
    """Reset the tenant admin back to the shared temporary password.

    Returns ``(user_id, email, temporary_password)``.
    """
    tenant = _get_real_tenant(db, tenant_id)
    if not tenant.admin_email:
        raise ConflictError(f"tenant '{tenant.name}' has no admin email set")

    user_id = _tenant_admin_user_id(db, tenant)
    if user_id is None:
        kc_user = keycloak_admin.find_user_by_email(tenant.admin_email)
        if kc_user is None:
            raise NotFoundError(
                f"no account exists for {tenant.admin_email} — set the admin email again to provision one"
            )
        user_id = kc_user.id

    password = keycloak_admin.reset_password(user_id)
    _log(db, actor, "reset_tenant_admin_password", f"tenant_id={tenant_id}")
    db.commit()
    return user_id, tenant.admin_email, password


# ── Platform admin management ──────────────────────────────────────────────


def _platform_admin_read(db: Session, user_id: str, tenant_id: uuid.UUID) -> PlatformAdminRead:
    role = _get_role(db, PLATFORM_ADMIN_ROLE)
    row = db.execute(
        select(User, UserRole.assigned_at)
        .join(UserRole, UserRole.user_id == User.id)
        .where(
            User.id == user_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == tenant_id,
        )
    ).one_or_none()
    if row is None:
        raise NotFoundError(f"user {user_id} is not a platform admin")
    return PlatformAdminRead(
        id=row.User.id,
        email=row.User.email,
        username=row.User.username,
        assigned_at=row.assigned_at,
    )


def list_platform_admins(db: Session) -> list[PlatformAdminRead]:
    """List all users who hold the platform_admin role."""
    platform_tenant = _get_platform_tenant(db)
    role = db.execute(
        select(Role).where(Role.slug == PLATFORM_ADMIN_ROLE)
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
        PlatformAdminRead(
            id=row.User.id,
            email=row.User.email,
            username=row.User.username,
            assigned_at=row.assigned_at,
        )
        for row in rows
    ]


def create_platform_admin(
    db: Session, actor: CurrentUser, data: PlatformAdminCreate
) -> PlatformAdminWithCredentialRead:
    """Add a platform admin, either by provisioning a new account from an email
    or by promoting a user who already exists locally."""
    platform_tenant = _get_platform_tenant(db)

    if data.email is not None:
        existing_local = db.execute(
            select(User).where(func.lower(User.email) == data.email)
        ).scalars().first()
        if existing_local is not None and _has_platform_admin(
            db, existing_local.id, platform_tenant.id
        ):
            raise ConflictError(f"{data.email} is already a platform admin")

        provisioned = _provision_admin(
            db,
            email=data.email,
            username=data.username,
            role_slug=PLATFORM_ADMIN_ROLE,
            tenant_id=platform_tenant.id,
            actor=actor,
        )
        _log(db, actor, "create_platform_admin", f"email={data.email}")
        db.commit()
        return PlatformAdminWithCredentialRead(
            admin=_platform_admin_read(db, provisioned.user_id, platform_tenant.id),
            created=provisioned.created,
            temporary_password=provisioned.temporary_password,
        )

    assign_platform_admin(db, actor, data.user_id)
    return PlatformAdminWithCredentialRead(
        admin=_platform_admin_read(db, data.user_id, platform_tenant.id),
        created=False,
        temporary_password=None,
    )


def _has_platform_admin(db: Session, user_id: str, platform_tenant_id: uuid.UUID) -> bool:
    role = _get_role(db, PLATFORM_ADMIN_ROLE)
    return db.execute(
        select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == platform_tenant_id,
        )
    ).scalar_one_or_none() is not None


def assign_platform_admin(
    db: Session, actor: CurrentUser, target_user_id: str
) -> None:
    """Grant platform_admin to a user who already exists in the users table."""
    platform_tenant = _get_platform_tenant(db)

    user = db.get(User, target_user_id)
    if user is None:
        raise NotFoundError(f"user {target_user_id} not found")
    if user.deleted_at is not None:
        raise ConflictError(f"user {target_user_id} is soft-deleted")

    role = _get_role(db, PLATFORM_ADMIN_ROLE)

    granted = _grant_role(
        db,
        user_id=target_user_id,
        role=role,
        tenant_id=platform_tenant.id,
        assigned_by=actor.sub,
    )
    if not granted:
        raise ConflictError(f"user {target_user_id} is already a platform admin")

    _log(db, actor, "assign_platform_admin", f"target={target_user_id}")
    db.commit()


def update_platform_admin(
    db: Session, actor: CurrentUser, target_user_id: str, data: PlatformAdminUpdate
) -> PlatformAdminRead:
    """Update a platform admin's email/username in both Keycloak and the mirror.

    Keycloak is written first: it owns the identity, and a local row that
    disagrees with the token's claims is worse than a failed edit.
    """
    platform_tenant = _get_platform_tenant(db)
    if not _has_platform_admin(db, target_user_id, platform_tenant.id):
        raise NotFoundError(f"user {target_user_id} is not a platform admin")

    user = db.get(User, target_user_id)
    if user is None:
        raise NotFoundError(f"user {target_user_id} not found")

    if data.email is not None:
        clash = db.execute(
            select(User).where(
                func.lower(User.email) == data.email, User.id != target_user_id
            )
        ).scalars().first()
        if clash is not None:
            raise ConflictError(f"another user already uses {data.email}")

    keycloak_admin.update_user(
        target_user_id, email=data.email, username=data.username
    )

    if data.email is not None:
        user.email = data.email
    if data.username is not None:
        user.username = data.username

    _log(db, actor, "update_platform_admin", f"target={target_user_id}")
    db.commit()
    return _platform_admin_read(db, target_user_id, platform_tenant.id)


def reset_platform_admin_password(
    db: Session, actor: CurrentUser, target_user_id: str
) -> tuple[str, str]:
    """Reset a platform admin to the temporary password.  Returns (email, password)."""
    platform_tenant = _get_platform_tenant(db)
    if not _has_platform_admin(db, target_user_id, platform_tenant.id):
        raise NotFoundError(f"user {target_user_id} is not a platform admin")

    user = db.get(User, target_user_id)
    password = keycloak_admin.reset_password(target_user_id)
    _log(db, actor, "reset_platform_admin_password", f"target={target_user_id}")
    db.commit()
    return (user.email if user else ""), password


def revoke_platform_admin(
    db: Session, actor: CurrentUser, target_user_id: str
) -> None:
    """Revoke platform_admin from a user. Blocks self-lockout."""
    platform_tenant = _get_platform_tenant(db)
    role = _get_role(db, PLATFORM_ADMIN_ROLE)

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
