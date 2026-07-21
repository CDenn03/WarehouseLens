"""Test fixtures: SQLite in-memory DB (the models are dialect-portable by
design) + FastAPI TestClient with the get_db dependency overridden.

Auth in tests goes through the X-Debug-User header the security scaffold
accepts ("sub:username:role1|role2") — that's exactly what it exists for.
"""

import os

# Must land before any `app.*` import: app.core.database creates its engine at
# import time, and the default URL is Postgres (whose driver tests don't need).
os.environ.setdefault("DATABASE_URL", "sqlite://")

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models import (
    Base,
    Product,
    Supplier,
    UserWarehouseAssignment,
    Warehouse,
    WarehouseStock,
)

ADMIN = {"X-Debug-User": "sub-admin:admin:admin"}
AUDITOR = {"X-Debug-User": "sub-auditor:auditor:auditor"}
NAIROBI_MANAGER = {"X-Debug-User": "sub-nai-mgr:nai.manager:warehouse_manager"}


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = TestSession()
    yield session
    session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded(db_session):
    """Two warehouses, two products (one with differing reorder points per
    warehouse — Section 12), one supplier, stock, and a scoped user assigned
    to Nairobi only."""
    nairobi = Warehouse(name="Nairobi Central")
    mombasa = Warehouse(name="Mombasa Port")
    widget = Product(sku="SKU-1", name="Widget", category="Parts", unit_cost=Decimal("10.00"))
    gadget = Product(sku="SKU-2", name="Gadget", category="Parts", unit_cost=Decimal("25.00"))
    supplier = Supplier(name="Acme", lead_time_days=5, contact_email="a@acme.test")
    db_session.add_all([nairobi, mombasa, widget, gadget, supplier])
    db_session.flush()

    db_session.add_all(
        [
            # widget: different reorder points in the two warehouses, below in Nairobi
            WarehouseStock(
                warehouse_id=nairobi.id, product_id=widget.id, quantity_on_hand=50, reorder_point=80
            ),
            WarehouseStock(
                warehouse_id=mombasa.id, product_id=widget.id, quantity_on_hand=50, reorder_point=20
            ),
            WarehouseStock(
                warehouse_id=nairobi.id, product_id=gadget.id, quantity_on_hand=200, reorder_point=30
            ),
        ]
    )
    db_session.add(
        UserWarehouseAssignment(user_id="sub-nai-mgr", warehouse_id=nairobi.id)
    )
    db_session.commit()
    return {
        "nairobi": nairobi,
        "mombasa": mombasa,
        "widget": widget,
        "gadget": gadget,
        "supplier": supplier,
    }


@pytest.fixture()
def today() -> str:
    return date.today().isoformat()
