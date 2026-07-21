from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import ROLE_ADMIN, CurrentUser, get_current_user, require_roles
from app.schemas.warehouse import AssignmentCreate, AssignmentRead, WarehouseCreate, WarehouseRead
from app.services import warehouse_service

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


@router.get("", response_model=list[WarehouseRead])
def list_warehouses(
    db: Session = Depends(get_db), _user: CurrentUser = Depends(get_current_user)
):
    return warehouse_service.list_warehouses(db)


@router.post("", response_model=WarehouseRead, status_code=201)
def create_warehouse(
    data: WarehouseCreate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles(ROLE_ADMIN)),
):
    return warehouse_service.create_warehouse(db, data)


@router.post("/{warehouse_id}/assignments", response_model=AssignmentRead, status_code=201)
def assign_user(
    warehouse_id: UUID,
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles(ROLE_ADMIN)),
):
    return warehouse_service.assign_user(db, warehouse_id, data.user_id)
