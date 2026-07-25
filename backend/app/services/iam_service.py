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

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.permissions.warehouse import WAREHOUSE_ASSIGN_USER, WAREHOUSE_GLOBAL
from app.core.permissions.iam import IAM_USER_ROLE_ASSIGN
from app.models.authorization import (
    AccessDecision,
    Role,
    RolePermission,
    UserRole,
)
from app.models.tenant import User, UserTenant
from app.models.warehouse import UserWarehouseAssignment, Warehouse
from app.schemas.iam import (
    AssignRoleRequest,
    AssignWarehouseRequest,
    RoleRead,
    UserRead,
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
) -> list[UserRead]:
    """List all users in the given tenant."""
    stmt = (
        select(User)
        .join(UserTenant, UserTenant.user_id == User.id)
        .where(UserTenant.tenant_id == tenant_id)
        .order_by(User.username)
    )
    if not include_deleted:
        stmt = stmt.where(User.deleted_at.is_(None))
    users = db.execute(stmt).scalars().all()
    return [_user_to_read(db, u, tenant_id) for u in users]


def get_user(db: Session, user_id: str, tenant_id: uuid.UUID) -> UserRead:
    """Fetch a single user's IAM detail within the tenant."""
    user = _get_user_in_tenant(db, user_id, tenant_id)
    return _user_to_read(db, user, tenant_id)


def list_roles(db: Session) -> list[RoleRead]:
    """All roles — used to populate role picker in the UI."""
    roles = db.execute(select(Role).order_by(Role.name)).scalars().all()
    return [RoleRead(id=r.id, slug=r.slug, name=r.name) for r in roles]


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
