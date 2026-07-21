from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
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
from app.schemas.inventory import TransactionCreate, TransactionRead
from app.schemas.product import ProductCreate, ProductRead, ProductStockBreakdown
from app.services import inventory_service

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
    _user: CurrentUser = Depends(require_roles(ROLE_ADMIN, ROLE_PROCUREMENT_OFFICER)),
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
    user: CurrentUser = Depends(require_roles(ROLE_ADMIN, ROLE_WAREHOUSE_MANAGER)),
):
    enforce_warehouse_scope(db, user, data.warehouse_id)
    return inventory_service.create_manual_transaction(db, data)
