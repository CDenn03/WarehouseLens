"""IAM router — user/role/warehouse-assignment management for tenant admins.

Endpoints:
  GET    /iam/users                         — list users in tenant
  GET    /iam/users/{user_id}               — single user detail
  GET    /iam/roles                         — list all roles (picker)

  POST   /iam/users/{user_id}/roles         — assign a role
  DELETE /iam/users/{user_id}/roles/{slug}  — revoke a role

  POST   /iam/users/{user_id}/warehouses    — assign a warehouse
  DELETE /iam/users/{user_id}/warehouses/{warehouse_id} — revoke

Permission gates match the domain name:
  - Reads  → iam.user.read
  - Role writes  → iam.user_role.assign
  - Warehouse writes → warehouse.assign_user
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions.iam import IAM_USER_READ, IAM_USER_ROLE_ASSIGN
from app.core.permissions.warehouse import WAREHOUSE_ASSIGN_USER
from app.core.security import CurrentUser, require_permission
from app.schemas.iam import (
    AssignRoleRequest,
    AssignWarehouseRequest,
    RoleRead,
    UserRead,
)
from app.services import iam_service

router = APIRouter(prefix="/iam", tags=["iam"])


# ── Read endpoints ─────────────────────────────────────────────────────────


@router.get("/users", response_model=list[UserRead])
def list_users(
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_READ)),
):
    """List users in the caller's tenant.

    By default excludes soft-deleted users.  Pass ``include_deleted=true``
    to include them for historical/audit views.
    """
    return iam_service.list_users(db, actor.tenant_id, include_deleted=include_deleted)


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_READ)),
):
    """Return a single user's detail including roles and warehouse assignments."""
    return iam_service.get_user(db, user_id, actor.tenant_id)


@router.get("/roles", response_model=list[RoleRead])
def list_roles(
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(IAM_USER_READ)),
):
    """List all roles — used to populate the role picker in the admin UI."""
    return iam_service.list_roles(db)


# ── Role assignment ────────────────────────────────────────────────────────


@router.post("/users/{user_id}/roles", response_model=UserRead, status_code=201)
def assign_role(
    user_id: str,
    data: AssignRoleRequest,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_ROLE_ASSIGN)),
):
    """Assign a role to a user within the caller's tenant."""
    return iam_service.assign_role(db, actor=actor, target_user_id=user_id, data=data)


@router.delete("/users/{user_id}/roles/{slug}", status_code=204)
def revoke_role(
    user_id: str,
    slug: str,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_ROLE_ASSIGN)),
):
    """Revoke a role from a user.  Rejects if this would lock out the tenant."""
    iam_service.revoke_role(db, actor=actor, target_user_id=user_id, role_slug=slug)


# ── Warehouse assignment ───────────────────────────────────────────────────


@router.post(
    "/users/{user_id}/warehouses", response_model=UserRead, status_code=201
)
def assign_warehouse(
    user_id: str,
    data: AssignWarehouseRequest,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(WAREHOUSE_ASSIGN_USER)),
):
    """Assign a warehouse to a user within the caller's tenant."""
    return iam_service.assign_warehouse(
        db, actor=actor, target_user_id=user_id, data=data
    )


@router.delete(
    "/users/{user_id}/warehouses/{warehouse_id}", status_code=204
)
def revoke_warehouse(
    user_id: str,
    warehouse_id: UUID,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(WAREHOUSE_ASSIGN_USER)),
):
    """Revoke a warehouse assignment from a user."""
    iam_service.revoke_warehouse(
        db, actor=actor, target_user_id=user_id, warehouse_id=warehouse_id
    )
