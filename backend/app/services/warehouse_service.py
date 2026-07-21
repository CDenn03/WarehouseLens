from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models import UserWarehouseAssignment, Warehouse
from app.schemas.warehouse import WarehouseCreate


def list_warehouses(db: Session) -> list[Warehouse]:
    return list(db.execute(select(Warehouse).order_by(Warehouse.name)).scalars())


def get_warehouse(db: Session, warehouse_id: UUID) -> Warehouse:
    wh = db.get(Warehouse, warehouse_id)
    if wh is None:
        raise NotFoundError(f"warehouse {warehouse_id} not found")
    return wh


def create_warehouse(db: Session, data: WarehouseCreate) -> Warehouse:
    wh = Warehouse(name=data.name, address=data.address)
    db.add(wh)
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
