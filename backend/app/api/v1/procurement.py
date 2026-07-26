from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.permissions.procurement import (
    PROCUREMENT_ORDER_CREATE,
    PROCUREMENT_ORDER_RECEIVE,
    PROCUREMENT_SUPPLIER_CREATE,
)
from app.core.security import (
    CurrentUser,
    enforce_tenant_scope,
    enforce_warehouse_scope,
    get_current_user,
    require_permission,
    scope_filter_warehouse_ids,
)
from app.schemas.common import PaginatedResponse
from app.schemas.procurement import (
    PurchaseOrderCreate,
    PurchaseOrderRead,
    PurchaseOrderReceive,
)
from app.schemas.supplier import SupplierCreate, SupplierRead
from app.services import procurement_service
from app.services.permission_service import log_access_decision
from app.services.warehouse_service import get_warehouse

router = APIRouter(tags=["procurement"])


def _pagination(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str | None = Query(default=None),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order)


@router.get("/suppliers", response_model=list[SupplierRead])
def list_suppliers(
    db: Session = Depends(get_db), _user: CurrentUser = Depends(get_current_user)
):
    return procurement_service.list_suppliers(db)


@router.post("/suppliers", response_model=SupplierRead, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_permission(PROCUREMENT_SUPPLIER_CREATE)),
):
    return procurement_service.create_supplier(db, data)


@router.get("/purchase-orders", response_model=PaginatedResponse)
def list_purchase_orders(
    params: PaginationParams = Depends(_pagination),
    warehouse_id: UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if warehouse_id is not None:
        enforce_warehouse_scope(db, user, warehouse_id)
    visible = scope_filter_warehouse_ids(db, user)
    return procurement_service.list_purchase_orders(db, params, visible, warehouse_id, status)


@router.post("/purchase-orders", response_model=PurchaseOrderRead, status_code=201)
def create_purchase_order(
    data: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(PROCUREMENT_ORDER_CREATE)),
):
    wh = get_warehouse(db, data.destination_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, data.destination_warehouse_id)
    return procurement_service.create_purchase_order(db, data)


@router.post("/purchase-orders/{po_id}/receive", response_model=PurchaseOrderRead)
def receive_purchase_order(
    po_id: UUID,
    data: PurchaseOrderReceive | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(PROCUREMENT_ORDER_RECEIVE)),
):
    po = procurement_service.get_purchase_order(db, po_id)
    wh = get_warehouse(db, po.destination_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, po.destination_warehouse_id)

    result = procurement_service.receive_purchase_order(db, po_id, data or PurchaseOrderReceive())

    log_access_decision(
        db,
        user_id=user.sub,
        permission_id=PROCUREMENT_ORDER_RECEIVE,
        decision="allow",
        source="bff:permission_db",
        action_context=f"po_id={po_id}",
    )
    db.commit()

    return result
