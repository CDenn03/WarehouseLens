from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    ROLE_ADMIN,
    ROLE_PROCUREMENT_OFFICER,
    ROLE_WAREHOUSE_MANAGER,
    CurrentUser,
    enforce_warehouse_scope,
    get_current_user,
    require_roles,
    scope_filter_warehouse_ids,
)
from app.schemas.procurement import PurchaseOrderCreate, PurchaseOrderRead, PurchaseOrderReceive
from app.schemas.supplier import SupplierCreate, SupplierRead
from app.services import procurement_service

router = APIRouter(tags=["procurement"])


@router.get("/suppliers", response_model=list[SupplierRead])
def list_suppliers(
    db: Session = Depends(get_db), _user: CurrentUser = Depends(get_current_user)
):
    return procurement_service.list_suppliers(db)


@router.post("/suppliers", response_model=SupplierRead, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles(ROLE_ADMIN, ROLE_PROCUREMENT_OFFICER)),
):
    return procurement_service.create_supplier(db, data)


@router.get("/purchase-orders", response_model=list[PurchaseOrderRead])
def list_purchase_orders(
    warehouse_id: UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if warehouse_id is not None:
        enforce_warehouse_scope(db, user, warehouse_id)
    visible = scope_filter_warehouse_ids(db, user)
    return procurement_service.list_purchase_orders(db, visible, warehouse_id, status)


@router.post("/purchase-orders", response_model=PurchaseOrderRead, status_code=201)
def create_purchase_order(
    data: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles(ROLE_ADMIN, ROLE_PROCUREMENT_OFFICER)),
):
    enforce_warehouse_scope(db, user, data.destination_warehouse_id)
    return procurement_service.create_purchase_order(db, data)


@router.post("/purchase-orders/{po_id}/receive", response_model=PurchaseOrderRead)
def receive_purchase_order(
    po_id: UUID,
    data: PurchaseOrderReceive | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(
        require_roles(ROLE_ADMIN, ROLE_PROCUREMENT_OFFICER, ROLE_WAREHOUSE_MANAGER)
    ),
):
    po = procurement_service.get_purchase_order(db, po_id)
    enforce_warehouse_scope(db, user, po.destination_warehouse_id)
    return procurement_service.receive_purchase_order(db, po_id, data or PurchaseOrderReceive())
