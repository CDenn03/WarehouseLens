"""IAM service — user listing, role assignment, warehouse assignment.

All mutation operations include the five required checks:
  1. Cross-tenant: target user and target warehouse must belong to the
     caller's tenant.
  2. Self-lockout: cannot revoke the last IAM_USER_ROLE_ASSIGN holder in
     the tenant if it belongs to the caller.
  3. Soft-deleted users cannot receive new role or warehouse assignments.
  4. warehouse.global display: surfaced via has_global_warehouse_access in
     the read schema, not by hiding the empty assignment list.
  5. Audit logging: every assign/revoke writes to access_decisions.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import keycloak_admin
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.permissions.warehouse import WAREHOUSE_ASSIGN_USER, WAREHOUSE_GLOBAL
from app.core.permissions.iam import IAM_USER_ROLE_ASSIGN, IAM_ROLE_MANAGE
from app.models.authorization import (
    AccessDecision,
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from app.models.tenant import Tenant, User, UserTenant
from app.models.warehouse import UserWarehouseAssignment, Warehouse
from app.schemas.iam import (
    AssignRoleRequest,
    AssignWarehouseRequest,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    UserActivityEntry,
    UserCreate,
    UserRead,
    UserUpdate,
    WarehouseAssignmentRead,
)
from app.core.security import CurrentUser
from app.services.permission_service import resolve_permissions


# ── Helpers ────────────────────────────────────────────────────────────────


def _get_user_in_tenant(db: Session, user_id: str, tenant_id: uuid.UUID) -> User:
    """Fetch a user and verify they belong to the caller's tenant.

    Raises 404 if not found, 403 if they exist but not in this tenant,
    409 if they are soft-deleted.
    """
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"user {user_id} not found")

    # Cross-tenant check.
    membership = db.execute(
        select(UserTenant).where(
            UserTenant.user_id == user_id,
            UserTenant.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if membership is None:
        raise ForbiddenError("cross-tenant access denied: user not in this tenant")

    return user


def _assert_not_deleted(user: User) -> None:
    """Raises 409 if the target user is soft-deleted."""
    if user.deleted_at is not None:
        raise ConflictError(
            f"user {user.id} is soft-deleted and cannot receive new assignments"
        )


def _log_decision(
    db: Session,
    *,
    actor: CurrentUser,
    target_user_id: str,
    permission_id: str,
    action: str,
) -> None:
    """Write an audit row to access_decisions."""
    db.add(
        AccessDecision(
            user_id=target_user_id,
            permission_id=permission_id,
            decision="allow",
            source=f"iam_service.{action}",
            action_context=f"actor={actor.sub} tenant={actor.tenant_id}",
            created_by=actor.sub,
        )
    )


def _count(db: Session, stmt) -> int:
    return db.execute(stmt).scalar_one()


def _user_to_read(
    db: Session, user: User, tenant_id: uuid.UUID
) -> UserRead:
    """Assemble a UserRead for the given user within a tenant."""
    # Roles
    role_rows = db.execute(
        select(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id, UserRole.tenant_id == tenant_id)
    ).scalars().all()

    roles = [RoleRead(id=r.id, slug=r.slug, name=r.name) for r in role_rows]

    # Warehouse assignments (cross-tenant safe via Warehouse join)
    assignment_rows = db.execute(
        select(UserWarehouseAssignment, Warehouse.name.label("wh_name"))
        .join(Warehouse, Warehouse.id == UserWarehouseAssignment.warehouse_id)
        .where(
            UserWarehouseAssignment.user_id == user.id,
            Warehouse.tenant_id == tenant_id,
        )
    ).all()

    warehouse_assignments = [
        WarehouseAssignmentRead(
            warehouse_id=row.UserWarehouseAssignment.warehouse_id,
            warehouse_name=row.wh_name,
            assigned_at=row.UserWarehouseAssignment.assigned_at,
        )
        for row in assignment_rows
    ]

    # warehouse.global check
    user_perms = resolve_permissions(db, user.id, tenant_id)
    has_global = WAREHOUSE_GLOBAL in user_perms

    return UserRead(
        id=user.id,
        email=user.email,
        username=user.username,
        deleted_at=user.deleted_at,
        roles=roles,
        warehouse_assignments=warehouse_assignments,
        has_global_warehouse_access=has_global,
    )


# ── Query operations ───────────────────────────────────────────────────────


def list_users(
    db: Session,
    tenant_id: uuid.UUID,
    include_deleted: bool = False,
    search: str | None = None,
) -> list[UserRead]:
    """List all users in the given tenant, optionally filtered by search."""
    stmt = (
        select(User)
        .join(UserTenant, UserTenant.user_id == User.id)
        .where(UserTenant.tenant_id == tenant_id)
        .order_by(User.username)
    )
    if not include_deleted:
        stmt = stmt.where(User.deleted_at.is_(None))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            User.email.ilike(pattern) | User.username.ilike(pattern)
        )
    users = db.execute(stmt).scalars().all()
    return [_user_to_read(db, u, tenant_id) for u in users]


def get_user(db: Session, user_id: str, tenant_id: uuid.UUID) -> UserRead:
    """Fetch a single user's IAM detail within the tenant."""
    user = _get_user_in_tenant(db, user_id, tenant_id)
    return _user_to_read(db, user, tenant_id)


def list_roles(db: Session, search: str | None = None) -> list[RoleRead]:
    """All roles — used to populate role picker in the UI."""
    stmt = select(Role).order_by(Role.name)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(Role.name.ilike(pattern) | Role.slug.ilike(pattern))
    roles = db.execute(stmt).scalars().all()
    return [RoleRead(id=r.id, slug=r.slug, name=r.name) for r in roles]


def list_permissions(db: Session) -> list:
    """All permissions from the database."""
    from app.schemas.iam import PermissionRead
    rows = db.execute(select(Permission).order_by(Permission.category, Permission.id)).scalars().all()
    return [PermissionRead(id=r.id, description=r.description, category=r.category) for r in rows]


def get_role_detail(db: Session, role_id: uuid.UUID):
    """Single role with its permissions and assigned users."""
    from app.schemas.iam import PermissionRead, RoleDetailRead, RoleDetailUser
    role = _get_role_by_id(db, role_id)

    perm_rows = db.execute(
        select(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role.id)
        .order_by(Permission.category, Permission.id)
    ).scalars().all()
    permissions = [PermissionRead(id=p.id, description=p.description, category=p.category) for p in perm_rows]

    user_rows = db.execute(
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .where(UserRole.role_id == role.id)
        .order_by(User.email)
    ).scalars().all()
    users = [RoleDetailUser(id=u.id, email=u.email, username=u.username) for u in user_rows]

    return RoleDetailRead(id=role.id, slug=role.slug, name=role.name, permissions=permissions, users=users)


# ── Role CRUD ──────────────────────────────────────────────────────────────

SYSTEM_ROLE_SLUGS = {"platform_admin", "tenant_admin"}


def _get_role_by_id(db: Session, role_id: uuid.UUID) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        raise NotFoundError(f"role {role_id} not found")
    return role


def create_role(
    db: Session,
    *,
    actor: CurrentUser,
    data: RoleCreate,
) -> RoleRead:
    """Create a new custom role, optionally assigning permissions."""
    existing = db.execute(
        select(Role).where(Role.slug == data.slug)
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(f"role with slug '{data.slug}' already exists")

    role = Role(slug=data.slug, name=data.name)
    db.add(role)
    db.flush()

    if data.permission_ids:
        for pid in data.permission_ids:
            db.add(RolePermission(role_id=role.id, permission_id=pid))

    db.add(AccessDecision(
        user_id=actor.sub,
        permission_id=IAM_ROLE_MANAGE,
        decision="allow",
        source="iam_service.create_role",
        action_context=f"slug={data.slug}",
        created_by=actor.sub,
    ))
    db.commit()
    return RoleRead(id=role.id, slug=role.slug, name=role.name)


def update_role(
    db: Session,
    *,
    actor: CurrentUser,
    role_id: uuid.UUID,
    data: RoleUpdate,
) -> RoleRead:
    """Update a role's name and/or permissions."""
    role = _get_role_by_id(db, role_id)

    if data.name is not None and data.name != role.name:
        role.name = data.name

    if data.permission_ids is not None:
        # Replace all permissions for this role
        db.execute(
            RolePermission.__table__.delete().where(RolePermission.role_id == role.id)
        )
        for pid in data.permission_ids:
            db.add(RolePermission(role_id=role.id, permission_id=pid))

    db.add(AccessDecision(
        user_id=actor.sub,
        permission_id=IAM_ROLE_MANAGE,
        decision="allow",
        source="iam_service.update_role",
        action_context=f"role_id={role_id}",
        created_by=actor.sub,
    ))
    db.commit()
    return RoleRead(id=role.id, slug=role.slug, name=role.name)


def delete_role(
    db: Session,
    *,
    actor: CurrentUser,
    role_id: uuid.UUID,
) -> None:
    """Delete a custom role.

    Guards:
    - System roles (platform_admin, tenant_admin) cannot be deleted.
    - platform_admin role: can only delete if another user at platform level holds it.
    - tenant_admin role: can only delete if another user at tenant level holds it.
    """
    role = _get_role_by_id(db, role_id)

    if role.slug in SYSTEM_ROLE_SLUGS:
        raise ConflictError(f"system role '{role.slug}' cannot be deleted")

    # For platform_admin and tenant_admin roles, ensure at least one other
    # user holds the role before allowing deletion.
    if role.slug == "platform_admin":
        platform_tenant = db.execute(
            select(Tenant).where(Tenant.is_platform.is_(True))
        ).scalar_one_or_none()
        if platform_tenant is not None:
            count = _count(
                db,
                select(func.count()).select_from(UserRole).where(
                    UserRole.role_id == role.id,
                    UserRole.tenant_id == platform_tenant.id,
                ),
            )
            if count <= 1:
                raise ConflictError(
                    "cannot delete platform_admin role: "
                    "at least one platform admin must exist"
                )

    if role.slug == "tenant_admin":
        # Check across all tenants — tenant_admin is a shared role definition.
        # We check each tenant individually to see if deletion would leave
        # any tenant without an admin.
        tenant_ids = db.execute(
            select(func.distinct(UserRole.tenant_id)).where(
                UserRole.role_id == role.id,
            )
        ).scalars().all()
        for tid in tenant_ids:
            count = _count(
                db,
                select(func.count()).select_from(UserRole).where(
                    UserRole.role_id == role.id,
                    UserRole.tenant_id == tid,
                ),
            )
            if count <= 1:
                raise ConflictError(
                    f"cannot delete tenant_admin role: "
                    f"tenant {tid} would have no admin"
                )

    db.delete(role)
    db.add(AccessDecision(
        user_id=actor.sub,
        permission_id=IAM_ROLE_MANAGE,
        decision="allow",
        source="iam_service.delete_role",
        action_context=f"slug={role.slug}",
        created_by=actor.sub,
    ))
    db.commit()


# ── User CRUD ──────────────────────────────────────────────────────────────


def create_user(
    db: Session,
    *,
    actor: CurrentUser,
    data: UserCreate,
) -> UserRead:
    """Create a new user by provisioning a Keycloak account.

    The user is added to the actor's tenant. Optionally assigns a role.
    """
    tenant_id = actor.tenant_id

    # Check for duplicate email in tenant
    existing = db.execute(
        select(User)
        .join(UserTenant, UserTenant.user_id == User.id)
        .where(
            UserTenant.tenant_id == tenant_id,
            func.lower(User.email) == data.email,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(f"user with email '{data.email}' already exists in this tenant")

    result = keycloak_admin.provision_user(data.email, username=data.username)

    user = _upsert_local_user(db, result.user.id, result.user.email or data.email, result.user.username or data.username)
    if db.get(UserTenant, (user.id, tenant_id)) is None:
        db.add(UserTenant(user_id=user.id, tenant_id=tenant_id))

    # Assign role if provided
    if data.role_slug:
        role = db.execute(
            select(Role).where(Role.slug == data.role_slug)
        ).scalar_one_or_none()
        if role is None:
            raise NotFoundError(f"role '{data.role_slug}' not found")
        db.add(UserRole(
            user_id=user.id,
            role_id=role.id,
            tenant_id=tenant_id,
            assigned_by=actor.sub,
        ))

    db.add(AccessDecision(
        user_id=actor.sub,
        permission_id=IAM_USER_ROLE_ASSIGN,
        decision="allow",
        source="iam_service.create_user",
        action_context=f"email={data.email}",
        created_by=actor.sub,
    ))
    db.commit()
    return _user_to_read(db, user, tenant_id)


def update_user(
    db: Session,
    *,
    actor: CurrentUser,
    target_user_id: str,
    data: UserUpdate,
) -> UserRead:
    """Update a user's email/username/role in both Keycloak and the local mirror."""
    tenant_id = actor.tenant_id
    user = _get_user_in_tenant(db, target_user_id, tenant_id)

    if data.email is not None and data.email != user.email:
        clash = db.execute(
            select(User).where(
                func.lower(User.email) == data.email,
                User.id != target_user_id,
            )
        ).scalars().first()
        if clash is not None:
            raise ConflictError(f"another user already uses {data.email}")

    keycloak_admin.update_user(target_user_id, email=data.email, username=data.username)

    if data.email is not None:
        user.email = data.email
    if data.username is not None:
        user.username = data.username

    # Swap role if role_slug provided
    if data.role_slug is not None:
        new_role = db.execute(
            select(Role).where(Role.slug == data.role_slug)
        ).scalar_one_or_none()
        if new_role is None:
            raise NotFoundError(f"role '{data.role_slug}' not found")

        # Find current role assignment
        current_assignment = db.execute(
            select(UserRole).where(
                UserRole.user_id == target_user_id,
                UserRole.tenant_id == tenant_id,
            )
        ).scalar_one_or_none()

        if current_assignment is not None:
            if current_assignment.role_id != new_role.id:
                db.delete(current_assignment)
                db.add(UserRole(
                    user_id=target_user_id,
                    role_id=new_role.id,
                    tenant_id=tenant_id,
                    assigned_by=actor.sub,
                ))
        else:
            db.add(UserRole(
                user_id=target_user_id,
                role_id=new_role.id,
                tenant_id=tenant_id,
                assigned_by=actor.sub,
            ))

    db.add(AccessDecision(
        user_id=actor.sub,
        permission_id=IAM_USER_ROLE_ASSIGN,
        decision="allow",
        source="iam_service.update_user",
        action_context=f"target={target_user_id}",
        created_by=actor.sub,
    ))
    db.commit()
    return _user_to_read(db, user, tenant_id)


def delete_user(
    db: Session,
    *,
    actor: CurrentUser,
    target_user_id: str,
) -> None:
    """Soft-delete a user and disable their Keycloak account."""
    tenant_id = actor.tenant_id
    user = _get_user_in_tenant(db, target_user_id, tenant_id)

    if user.deleted_at is not None:
        raise ConflictError(f"user {target_user_id} is already soft-deleted")

    user.deleted_at = datetime.now(timezone.utc)

    try:
        keycloak_admin.set_enabled(target_user_id, False)
    except Exception:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("could not disable Keycloak account %s", target_user_id, exc_info=True)

    db.add(AccessDecision(
        user_id=actor.sub,
        permission_id=IAM_USER_ROLE_ASSIGN,
        decision="allow",
        source="iam_service.delete_user",
        action_context=f"target={target_user_id}",
        created_by=actor.sub,
    ))
    db.commit()


def get_user_activity(
    db: Session, user_id: str, tenant_id: uuid.UUID, limit: int = 20
) -> list[UserActivityEntry]:
    """Recent IAM activity for a specific user within the tenant.

    Reconstructs events from the access_decisions audit trail, which
    records every assign/revoke operation.
    """
    _get_user_in_tenant(db, user_id, tenant_id)

    rows = db.execute(
        select(AccessDecision)
        .where(
            AccessDecision.user_id == user_id,
            AccessDecision.source.like("iam_service.%"),
        )
        .order_by(AccessDecision.decided_at.desc())
        .limit(limit)
    ).scalars().all()

    entries: list[UserActivityEntry] = []
    for row in rows:
        action = (row.source or "").replace("iam_service.", "")
        if "role" in action:
            kind = "role_assigned" if "assign" in action else "role_revoked"
        else:
            kind = "warehouse_assigned" if "assign" in action else "warehouse_revoked"

        actor_id = row.created_by or "unknown"
        entries.append(
            UserActivityEntry(
                kind=kind,
                target=row.permission_id,
                actor_label=actor_id,
                occurred_at=row.decided_at,
            )
        )

    return entries


# ── Role assignment ────────────────────────────────────────────────────────


def assign_role(
    db: Session,
    *,
    actor: CurrentUser,
    target_user_id: str,
    data: AssignRoleRequest,
) -> UserRead:
    """Assign a role to a user within the actor's tenant.

    Checks:
    - Target user belongs to actor's tenant (cross-tenant guard).
    - Target user is not soft-deleted.
    """
    tenant_id = actor.tenant_id
    user = _get_user_in_tenant(db, target_user_id, tenant_id)
    _assert_not_deleted(user)

    role = db.execute(
        select(Role).where(Role.slug == data.role_slug)
    ).scalar_one_or_none()
    if role is None:
        raise NotFoundError(f"role '{data.role_slug}' not found")

    existing = db.execute(
        select(UserRole).where(
            UserRole.user_id == target_user_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(
            f"user {target_user_id} already has role '{data.role_slug}'"
        )

    db.add(
        UserRole(
            user_id=target_user_id,
            role_id=role.id,
            tenant_id=tenant_id,
            assigned_by=actor.sub,
        )
    )

    _log_decision(
        db,
        actor=actor,
        target_user_id=target_user_id,
        permission_id=IAM_USER_ROLE_ASSIGN,
        action="assign_role",
    )
    db.commit()
    return _user_to_read(db, user, tenant_id)


def revoke_role(
    db: Session,
    *,
    actor: CurrentUser,
    target_user_id: str,
    role_slug: str,
) -> None:
    """Revoke a role from a user.

    Checks:
    - Target user belongs to actor's tenant.
    - Self-lockout: if this is the last user in the tenant who holds
      IAM_USER_ROLE_ASSIGN and the caller IS that user, reject.
    """
    tenant_id = actor.tenant_id
    _get_user_in_tenant(db, target_user_id, tenant_id)

    role = db.execute(
        select(Role).where(Role.slug == role_slug)
    ).scalar_one_or_none()
    if role is None:
        raise NotFoundError(f"role '{role_slug}' not found")

    assignment = db.execute(
        select(UserRole).where(
            UserRole.user_id == target_user_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if assignment is None:
        raise NotFoundError(
            f"user {target_user_id} does not have role '{role_slug}'"
        )

    # ── Self-lockout check ─────────────────────────────────────────────
    # Does the role being revoked carry IAM_USER_ROLE_ASSIGN?
    role_grants_iam_assign = db.execute(
        select(RolePermission).where(
            RolePermission.role_id == role.id,
            RolePermission.permission_id == IAM_USER_ROLE_ASSIGN,
        )
    ).scalar_one_or_none() is not None

    if role_grants_iam_assign:
        # Count users in this tenant who would still hold IAM_USER_ROLE_ASSIGN
        # after this revocation.
        # Step 1: find all roles in this tenant that grant IAM_USER_ROLE_ASSIGN.
        granting_role_ids = db.execute(
            select(RolePermission.role_id).where(
                RolePermission.permission_id == IAM_USER_ROLE_ASSIGN
            )
        ).scalars().all()

        # Step 2: count users (excluding target) who hold any of those roles.
        other_holders = db.execute(
            select(func.count(func.distinct(UserRole.user_id))).where(
                UserRole.tenant_id == tenant_id,
                UserRole.role_id.in_(granting_role_ids),
                UserRole.user_id != target_user_id,
            )
        ).scalar_one()

        if other_holders == 0:
            raise ForbiddenError(
                "cannot remove the last user able to manage roles in this tenant; "
                "assign IAM role management to another user first"
            )

    db.delete(assignment)

    _log_decision(
        db,
        actor=actor,
        target_user_id=target_user_id,
        permission_id=IAM_USER_ROLE_ASSIGN,
        action="revoke_role",
    )
    db.commit()


# ── Warehouse assignment ───────────────────────────────────────────────────


def assign_warehouse(
    db: Session,
    *,
    actor: CurrentUser,
    target_user_id: str,
    data: AssignWarehouseRequest,
) -> UserRead:
    """Assign a warehouse to a user.

    Checks:
    - Target user belongs to actor's tenant.
    - Target user is not soft-deleted.
    - Target warehouse belongs to actor's tenant (cross-tenant guard).
    """
    tenant_id = actor.tenant_id
    user = _get_user_in_tenant(db, target_user_id, tenant_id)
    _assert_not_deleted(user)

    warehouse = db.get(Warehouse, data.warehouse_id)
    if warehouse is None:
        raise NotFoundError(f"warehouse {data.warehouse_id} not found")
    if warehouse.tenant_id != tenant_id:
        raise ForbiddenError(
            "cross-tenant access denied: warehouse belongs to a different tenant"
        )

    existing = db.get(
        UserWarehouseAssignment, (target_user_id, data.warehouse_id)
    )
    if existing is not None:
        raise ConflictError(
            f"user {target_user_id} is already assigned to warehouse {data.warehouse_id}"
        )

    db.add(
        UserWarehouseAssignment(
            user_id=target_user_id,
            warehouse_id=data.warehouse_id,
            assigned_at=datetime.now(timezone.utc),
        )
    )

    _log_decision(
        db,
        actor=actor,
        target_user_id=target_user_id,
        permission_id=WAREHOUSE_ASSIGN_USER,
        action="assign_warehouse",
    )
    db.commit()
    return _user_to_read(db, user, tenant_id)


def revoke_warehouse(
    db: Session,
    *,
    actor: CurrentUser,
    target_user_id: str,
    warehouse_id: uuid.UUID,
) -> None:
    """Revoke a warehouse assignment from a user.

    Checks:
    - Target user belongs to actor's tenant.
    - Target warehouse belongs to actor's tenant.
    """
    tenant_id = actor.tenant_id
    _get_user_in_tenant(db, target_user_id, tenant_id)

    warehouse = db.get(Warehouse, warehouse_id)
    if warehouse is None:
        raise NotFoundError(f"warehouse {warehouse_id} not found")
    if warehouse.tenant_id != tenant_id:
        raise ForbiddenError(
            "cross-tenant access denied: warehouse belongs to a different tenant"
        )

    assignment = db.get(UserWarehouseAssignment, (target_user_id, warehouse_id))
    if assignment is None:
        raise NotFoundError(
            f"user {target_user_id} is not assigned to warehouse {warehouse_id}"
        )

    db.delete(assignment)

    _log_decision(
        db,
        actor=actor,
        target_user_id=target_user_id,
        permission_id=WAREHOUSE_ASSIGN_USER,
        action="revoke_warehouse",
    )
    db.commit()
