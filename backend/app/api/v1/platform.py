"""Platform router — tenant CRUD and platform-admin management.

All endpoints require the platform pseudo-tenant context; callers must hold
``platform.tenant.manage`` (sourced from the platform_admin role).

Endpoints:
  GET    /platform/tenants                  — list all real tenants
  POST   /platform/tenants                  — create a new tenant
  GET    /platform/tenants/{tenant_id}      — single tenant detail

  GET    /platform/admins                   — list platform admins
  POST   /platform/admins                   — assign platform_admin to a user
  DELETE /platform/admins/{user_id}         — revoke platform_admin from a user
"""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions.platform import PLATFORM_TENANT_MANAGE
from app.core.security import CurrentUser, require_permission
from app.schemas.platform import (
    AssignPlatformAdminRequest,
    PlatformAdminRead,
    TenantCreate,
    TenantRead,
)
from app.services import platform_service

router = APIRouter(prefix="/platform", tags=["platform"])


# ── Tenant endpoints ───────────────────────────────────────────────────────


@router.get("/tenants", response_model=list[TenantRead])
def list_tenants(
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    return platform_service.list_tenants(db)


@router.post("/tenants", response_model=TenantRead, status_code=201)
def create_tenant(
    data: TenantCreate,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    return platform_service.create_tenant(db, actor, data)


@router.get("/tenants/{tenant_id}", response_model=TenantRead)
def get_tenant(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    return platform_service.get_tenant(db, tenant_id)


# ── Platform admin endpoints ───────────────────────────────────────────────


@router.get("/admins", response_model=list[PlatformAdminRead])
def list_platform_admins(
    db: Session = Depends(get_db),
    _actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    rows = platform_service.list_platform_admins(db)
    return [PlatformAdminRead(**r) for r in rows]


@router.post("/admins", status_code=201)
def assign_platform_admin(
    data: AssignPlatformAdminRequest,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    platform_service.assign_platform_admin(db, actor, data.user_id)
    return {"ok": True}


@router.delete("/admins/{user_id}", status_code=204)
def revoke_platform_admin(
    user_id: str,
    db: Session = Depends(get_db),
    actor: CurrentUser = Depends(require_permission(PLATFORM_TENANT_MANAGE)),
):
    platform_service.revoke_platform_admin(db, actor, user_id)
