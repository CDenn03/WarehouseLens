"""IAM router — user/role/warehouse-assignment management for tenant admins.

Endpoints:
  GET    /iam/users                         — list users in tenant
  POST   /iam/users                         — create user
  GET    /iam/users/{user_id}               — single user detail
  PATCH  /iam/users/{user_id}               — update user
  DELETE /iam/users/{user_id}               — soft-delete user
  GET    /iam/users/{user_id}/activity      — recent activity

  GET    /iam/roles                         — list all roles
  POST   /iam/roles                         — create role
  PATCH  /iam/roles/{role_id}               — update role
  DELETE /iam/roles/{role_id}               — delete role

  POST   /iam/users/{user_id}/roles         — assign a role
  DELETE /iam/users/{user_id}/roles/{slug}  — revoke a role

  POST   /iam/users/{user_id}/warehouses    — assign a warehouse
  DELETE /iam/users/{user_id}/warehouses/{warehouse_id} — revoke
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions.iam import IAM_USER_READ, IAM_USER_ROLE_ASSIGN, IAM_ROLE_MANAGE
from app.core.permissions.warehouse import WAREHOUSE_ASSIGN_USER
from app.core.security import CurrentUser, require_permission
from app.schemas.iam import (
    AssignRoleRequest,
    AssignWarehouseRequest,
    PermissionRead,
    RoleCreate,
    RoleDetailRead,
    RoleRead,
    RoleUpdate,
    UserActivityEntry,
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.services import iam_service

router = APIRouter(prefix="/iam", tags=["iam"])


# ── Read endpoints ─────────────────────────────────────────────────────────


@router.get("/users", response_model=list[UserRead])
def list_users(
    include_deleted: bool = Query(default=False),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_READ)),
):
    """List users in the caller's tenant, optionally filtered by search term."""
    return iam_service.list_users(db, actor.tenant_id, include_deleted=include_deleted, search=search)


@router.post("/users", response_model=UserRead, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_ROLE_ASSIGN)),
):
    """Create a new user by provisioning a Keycloak account."""
    return iam_service.create_user(db, actor=actor, data=data)


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_READ)),
):
    """Return a single user's detail including roles and warehouse assignments."""
    return iam_service.get_user(db, user_id, actor.tenant_id)


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_ROLE_ASSIGN)),
):
    """Update a user's email/username."""
    return iam_service.update_user(db, actor=actor, target_user_id=user_id, data=data)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_ROLE_ASSIGN)),
):
    """Soft-delete a user and disable their Keycloak account."""
    iam_service.delete_user(db, actor=actor, target_user_id=user_id)


@router.get("/users/{user_id}/activity", response_model=list[UserActivityEntry])
def get_user_activity(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_USER_READ)),
):
    """Recent IAM activity for a user (role/warehouse assignments and revocations)."""
    return iam_service.get_user_activity(db, user_id, actor.tenant_id, limit=limit)


@router.get("/roles", response_model=list[RoleRead])
def list_roles(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(IAM_USER_READ)),
):
    """List all roles — used to populate the role picker in the admin UI."""
    return iam_service.list_roles(db, search=search)


@router.get("/roles/{role_id}", response_model=RoleDetailRead)
def get_role(
    role_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(IAM_USER_READ)),
):
    """Single role with its permissions and assigned users."""
    return iam_service.get_role_detail(db, role_id)


@router.get("/permissions", response_model=list[PermissionRead])
def list_permissions(
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(IAM_USER_READ)),
):
    """All permissions in the system."""
    return iam_service.list_permissions(db)


@router.post("/roles", response_model=RoleRead, status_code=201)
def create_role(
    data: RoleCreate,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_ROLE_MANAGE)),
):
    """Create a new custom role."""
    return iam_service.create_role(db, actor=actor, data=data)


@router.patch("/roles/{role_id}", response_model=RoleRead)
def update_role(
    role_id: uuid.UUID,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_ROLE_MANAGE)),
):
    """Update a role's name."""
    return iam_service.update_role(db, actor=actor, role_id=role_id, data=data)


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(
    role_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(IAM_ROLE_MANAGE)),
):
    """Delete a custom role. System roles cannot be deleted."""
    iam_service.delete_role(db, actor=actor, role_id=role_id)


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
    warehouse_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(WAREHOUSE_ASSIGN_USER)),
):
    """Revoke a warehouse assignment from a user."""
    iam_service.revoke_warehouse(
        db, actor=actor, target_user_id=user_id, warehouse_id=warehouse_id
    )
