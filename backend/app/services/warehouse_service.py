from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models import UserWarehouseAssignment, Warehouse
from app.schemas.warehouse import WarehouseCreate, WarehouseUpdate


def list_warehouses(db: Session, tenant_id: UUID) -> list[Warehouse]:
    return list(db.execute(
        select(Warehouse)
        .where(Warehouse.tenant_id == tenant_id)
        .order_by(Warehouse.name)
    ).scalars())


def get_warehouse(db: Session, warehouse_id: UUID) -> Warehouse:
    wh = db.get(Warehouse, warehouse_id)
    if wh is None:
        raise NotFoundError(f"warehouse {warehouse_id} not found")
    return wh


def create_warehouse(db: Session, data: WarehouseCreate, tenant_id: UUID) -> Warehouse:
    wh = Warehouse(name=data.name, address=data.address, tenant_id=tenant_id)
    db.add(wh)
    db.commit()
    return wh


def update_warehouse(db: Session, warehouse_id: UUID, data: WarehouseUpdate) -> Warehouse:
    wh = get_warehouse(db, warehouse_id)
    if data.name is not None:
        wh.name = data.name
    if data.address is not None:
        wh.address = data.address
    if data.is_active is not None:
        wh.is_active = data.is_active
    db.commit()
    return wh


def assign_user(db: Session, warehouse_id: UUID, user_id: str) -> UserWarehouseAssignment:
    get_warehouse(db, warehouse_id)
    existing = db.get(UserWarehouseAssignment, (user_id, warehouse_id))
    if existing is not None:
        raise ConflictError(f"user {user_id} already assigned to warehouse {warehouse_id}")
    assignment = UserWarehouseAssignment(user_id=user_id, warehouse_id=warehouse_id)
    db.add(assignment)
    db.commit()
    return assignment
