from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions.outbound import (
    OUTBOUND_PICK_LIST_MANAGE,
    OUTBOUND_SALES_ORDER_CREATE,
    OUTBOUND_SHIP_MANAGE,
    OUTBOUND_TRANSFER_CREATE,
)
from app.core.security import (
    CurrentUser,
    enforce_tenant_scope,
    enforce_warehouse_scope,
    get_current_user,
    require_permission,
    scope_filter_warehouse_ids,
)
from app.schemas.outbound import (
    OutboundRequestCreate,
    OutboundRequestDetail,
    OutboundRequestRead,
    PickItemUpdate,
    PickListCreate,
    PickListItemRead,
    PickListRead,
    SalesOrderCreate,
    SalesOrderRead,
    ShipmentRead,
    ShipRequest,
)
from app.services import outbound_service
from app.services.warehouse_service import get_warehouse

router = APIRouter(tags=["outbound"])


@router.post("/sales-orders", response_model=SalesOrderRead, status_code=201)
def create_sales_order(
    data: SalesOrderCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(OUTBOUND_SALES_ORDER_CREATE)),
):
    wh = get_warehouse(db, data.source_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, data.source_warehouse_id)
    order, request = outbound_service.create_sales_order(db, data)
    response = SalesOrderRead.model_validate(order)
    response.outbound_request_id = request.id
    return response


@router.get("/outbound-requests", response_model=list[OutboundRequestRead])
def list_outbound_requests(
    warehouse_id: UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if warehouse_id is not None:
        enforce_warehouse_scope(db, user, warehouse_id)
    visible = scope_filter_warehouse_ids(db, user)
    return outbound_service.list_outbound_requests(db, visible, warehouse_id, status)


@router.get("/outbound-requests/{request_id}", response_model=OutboundRequestDetail)
def get_outbound_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    request = outbound_service.get_outbound_request(db, request_id)
    wh = get_warehouse(db, request.source_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, request.source_warehouse_id)
    return request


@router.post("/outbound-requests", response_model=OutboundRequestRead, status_code=201)
def create_internal_transfer(
    data: OutboundRequestCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(OUTBOUND_TRANSFER_CREATE)),
):
    wh = get_warehouse(db, data.source_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, data.source_warehouse_id)
    return outbound_service.create_internal_transfer(db, data)


@router.post("/outbound-requests/{request_id}/pick-lists", response_model=PickListRead, status_code=201)
def generate_pick_list(
    request_id: UUID,
    data: PickListCreate | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(OUTBOUND_PICK_LIST_MANAGE)),
):
    request = outbound_service.get_outbound_request(db, request_id)
    wh = get_warehouse(db, request.source_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, request.source_warehouse_id)
    return outbound_service.generate_pick_list(db, request_id, data or PickListCreate())


@router.patch("/pick-lists/{pick_list_id}/items/{product_id}", response_model=PickListItemRead)
def record_pick(
    pick_list_id: UUID,
    product_id: UUID,
    data: PickItemUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(OUTBOUND_PICK_LIST_MANAGE)),
):
    pick_list = outbound_service.get_pick_list(db, pick_list_id)
    wh = get_warehouse(db, pick_list.outbound_request.source_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, pick_list.outbound_request.source_warehouse_id)
    return outbound_service.record_pick(db, pick_list_id, product_id, data)


@router.post("/pick-lists/{pick_list_id}/complete", response_model=PickListRead)
def complete_pick_list(
    pick_list_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(OUTBOUND_PICK_LIST_MANAGE)),
):
    pick_list = outbound_service.get_pick_list(db, pick_list_id)
    wh = get_warehouse(db, pick_list.outbound_request.source_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, pick_list.outbound_request.source_warehouse_id)
    return outbound_service.complete_pick_list(db, pick_list_id)


@router.post("/outbound-requests/{request_id}/ship", response_model=ShipmentRead, status_code=201)
def ship(
    request_id: UUID,
    data: ShipRequest | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(OUTBOUND_SHIP_MANAGE)),
):
    request = outbound_service.get_outbound_request(db, request_id)
    wh = get_warehouse(db, request.source_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, request.source_warehouse_id)
    return outbound_service.ship(db, request_id, data or ShipRequest())


@router.patch("/shipments/{shipment_id}/deliver", response_model=ShipmentRead)
def deliver(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(OUTBOUND_SHIP_MANAGE)),
):
    shipment = outbound_service.get_shipment(db, shipment_id)
    request = outbound_service.get_outbound_request(db, shipment.outbound_request_id)
    wh = get_warehouse(db, request.source_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, request.source_warehouse_id)
    return outbound_service.deliver(db, shipment_id)
