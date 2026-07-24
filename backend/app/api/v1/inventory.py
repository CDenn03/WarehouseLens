from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions.inventory import INVENTORY_PRODUCT_CREATE, INVENTORY_WRITE
from app.core.security import (
    CurrentUser,
    enforce_tenant_scope,
    enforce_warehouse_scope,
    get_current_user,
    require_permission,
    scope_filter_warehouse_ids,
)
from app.schemas.inventory import TransactionCreate, TransactionRead
from app.schemas.product import ProductCreate, ProductRead, ProductStockBreakdown
from app.services import inventory_service
from app.services.warehouse_service import get_warehouse
from uuid import UUID

router = APIRouter(tags=["inventory"])


@router.get("/products", response_model=list[ProductRead])
def list_products(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
):
    return inventory_service.list_products(db, search)


@router.post("/products", response_model=ProductRead, status_code=201)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_permission(INVENTORY_PRODUCT_CREATE)),
):
    return inventory_service.create_product(db, data)


@router.get("/products/{product_id}/stock", response_model=ProductStockBreakdown)
def product_stock(
    product_id: UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    visible = scope_filter_warehouse_ids(db, user)
    return inventory_service.product_stock_breakdown(db, product_id, visible)


@router.get("/inventory/transactions", response_model=list[TransactionRead])
def list_transactions(
    warehouse_id: UUID | None = None,
    product_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    if warehouse_id is not None:
        enforce_warehouse_scope(db, user, warehouse_id)
    visible = scope_filter_warehouse_ids(db, user)
    return inventory_service.list_transactions(
        db, visible, warehouse_id, product_id, date_from, date_to
    )


@router.post("/inventory/transactions", response_model=TransactionRead, status_code=201)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(INVENTORY_WRITE)),
):
    wh = get_warehouse(db, data.warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)
    enforce_warehouse_scope(db, user, data.warehouse_id)
    return inventory_service.create_manual_transaction(db, data)
