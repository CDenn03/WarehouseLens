from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions.warehouse import WAREHOUSE_ASSIGN_USER, WAREHOUSE_CREATE
from app.core.security import (
    CurrentUser,
    enforce_tenant_scope,
    get_current_user,
    require_permission,
)
from app.schemas.warehouse import (
    AssignmentCreate,
    AssignmentRead,
    WarehouseCreate,
    WarehouseRead,
)
from app.services import warehouse_service

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


@router.get("", response_model=list[WarehouseRead])
def list_warehouses(
    db: Session = Depends(get_db), _user: CurrentUser = Depends(get_current_user)
):
    return warehouse_service.list_warehouses(db, _user.tenant_id)


@router.post("", response_model=WarehouseRead, status_code=201)
def create_warehouse(
    data: WarehouseCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(WAREHOUSE_CREATE)),
):
    return warehouse_service.create_warehouse(db, data, user.tenant_id)


@router.post("/{warehouse_id}/assignments", response_model=AssignmentRead, status_code=201)
def assign_user(
    warehouse_id: UUID,
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(WAREHOUSE_ASSIGN_USER)),
):
    wh = warehouse_service.get_warehouse(db, warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    return warehouse_service.assign_user(db, warehouse_id, data.user_id)
