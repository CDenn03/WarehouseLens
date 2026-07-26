"""Platform router — tenant CRUD and platform-admin management.

All endpoints require the platform pseudo-tenant context; callers must hold
``platform.tenant.manage`` (sourced from the platform_admin role).

Endpoints:
  GET    /platform/tenants                          — list all real tenants
  POST   /platform/tenants                          — create tenant + first admin
  GET    /platform/tenants/{tenant_id}              — single tenant detail
  PATCH  /platform/tenants/{tenant_id}              — rename / change admin email
  DELETE /platform/tenants/{tenant_id}              — delete a tenant
  POST   /platform/tenants/{tenant_id}/admin/reset-password — reissue temp password

  GET    /platform/admins                           — list platform admins
  POST   /platform/admins                           — provision or promote an admin
  PATCH  /platform/admins/{user_id}                 — update email / username
  DELETE /platform/admins/{user_id}                 — revoke platform_admin
  POST   /platform/admins/{user_id}/reset-password  — reissue temp password
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.permissions.platform import PLATFORM_TENANT_MANAGE
from app.core.security import CurrentUser, require_permission
from app.schemas.common import PaginatedResponse
from app.schemas.platform import (
    PasswordResetRead,
    PlatformAdminCreate,
    PlatformAdminRead,
    PlatformAdminUpdate,
    PlatformAdminWithCredentialRead,
    TenantCreate,
    TenantRead,
    TenantUpdate,
    TenantWithAdminRead,
)
from app.services import platform_service

router = APIRouter(prefix="/platform", tags=["platform"])


# ── Tenant endpoints ───────────────────────────────────────────────────────


def _pagination(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    sort_by: str | None = Query(default=None),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size, search=search, sort_by=sort_by, sort_order=sort_order)


@router.get("/tenants", response_model=PaginatedResponse)
def list_tenants(
    params: PaginationParams = Depends(_pagination),
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    return platform_service.list_tenants(db, params)


@router.post("/tenants", response_model=TenantWithAdminRead, status_code=201)
def create_tenant(
    data: TenantCreate,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    """Create a tenant and provision ``admin_email`` as its first user.

    The response carries the temporary password once — Keycloak forces the new
    admin to replace it at first login.
    """
    return platform_service.create_tenant(db, actor, data)


@router.get("/tenants/{tenant_id}", response_model=TenantRead)
def get_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    return platform_service.get_tenant(db, tenant_id)


@router.patch("/tenants/{tenant_id}", response_model=TenantWithAdminRead)
def update_tenant(
    tenant_id: uuid.UUID,
    data: TenantUpdate,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    return platform_service.update_tenant(db, actor, tenant_id, data)


@router.delete("/tenants/{tenant_id}", status_code=204)
def delete_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    platform_service.delete_tenant(db, actor, tenant_id)


@router.post("/tenants/{tenant_id}/admin/reset-password", response_model=PasswordResetRead)
def reset_tenant_admin_password(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    user_id, email, password = platform_service.reset_tenant_admin_password(
        db, actor, tenant_id
    )
    return PasswordResetRead(user_id=user_id, email=email, temporary_password=password)


# ── Platform admin endpoints ───────────────────────────────────────────────


@router.get("/admins", response_model=PaginatedResponse)
def list_platform_admins(
    params: PaginationParams = Depends(_pagination),
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    return platform_service.list_platform_admins(db, params)


@router.post("/admins", response_model=PlatformAdminWithCredentialRead, status_code=201)
def create_platform_admin(
    data: PlatformAdminCreate,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    """Add a platform admin — by ``email`` (provisions a Keycloak account) or by
    ``user_id`` (promotes someone who has already signed in)."""
    return platform_service.create_platform_admin(db, actor, data)


@router.patch("/admins/{user_id}", response_model=PlatformAdminRead)
def update_platform_admin(
    user_id: str,
    data: PlatformAdminUpdate,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    return platform_service.update_platform_admin(db, actor, user_id, data)


@router.post("/admins/{user_id}/reset-password", response_model=PasswordResetRead)
def reset_platform_admin_password(
    user_id: str,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    email, password = platform_service.reset_platform_admin_password(db, actor, user_id)
    return PasswordResetRead(user_id=user_id, email=email, temporary_password=password)


@router.delete("/admins/{user_id}", status_code=204)
def revoke_platform_admin(
    user_id: str,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    platform_service.revoke_platform_admin(db, actor, user_id)
