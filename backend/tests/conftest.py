"""Test fixtures: SQLite in-memory DB (the models are dialect-portable by
design) + FastAPI TestClient with the get_db dependency overridden.

Auth in tests goes through the X-Debug-User header the security scaffold
accepts ("sub:username:perm1|perm2") — permission-based, not role-based.
The permission tables must be seeded for require_permission() to resolve.
"""

import os

# Must land before any `app.*` import: app.core.database creates its engine at
# import time, and the default URL is Postgres (whose driver tests don't need).
os.environ.setdefault("DATABASE_URL", "sqlite://")

from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
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
from app.models.authorization import Permission, Role, RolePermission, UserRole

# ── Test user IDs ──────────────────────────────────────────────────────

ADMIN_USER = "sub-admin"
AUDITOR_USER = "sub-auditor"
NAIROBI_MANAGER_USER = "sub-nai-mgr"

# ── Headers (permissions are resolved from DB, but this is the identity) ─

ADMIN = {"X-Debug-User": f"{ADMIN_USER}:admin:placeholder"}
AUDITOR = {"X-Debug-User": f"{AUDITOR_USER}:auditor:placeholder"}
NAIROBI_MANAGER = {"X-Debug-User": f"{NAIROBI_MANAGER_USER}:nai.manager:placeholder"}


# ── All permissions in the system ───────────────────────────────────────

ALL_PERMISSIONS = [
    ("warehouse.create", "Create warehouses", "warehouse"),
    ("warehouse.assign_user", "Assign users to warehouses", "warehouse"),
    ("warehouse.global", "Global warehouse scope", "warehouse"),
    ("inventory.read", "View inventory", "inventory"),
    ("inventory.write", "Create inventory transactions", "inventory"),
    ("inventory.product.create", "Create products", "inventory"),
    ("procurement.supplier.create", "Create suppliers", "procurement"),
    ("procurement.order.create", "Create purchase orders", "procurement"),
    ("procurement.order.receive", "Receive purchase orders", "procurement"),
    ("outbound.sales_order.create", "Create sales orders", "outbound"),
    ("outbound.transfer.create", "Create internal transfers", "outbound"),
    ("outbound.pick_list.manage", "Generate and complete pick lists", "outbound"),
    ("outbound.ship.manage", "Ship and deliver outbound requests", "outbound"),
    ("dashboard.read", "View dashboard", "dashboard"),
    ("forecast.read", "View forecasts", "forecast"),
    ("agent.invoke", "Invoke the AI agent", "agent"),
]


def _seed_permissions_and_roles(db_session) -> dict[str, Role]:
    """Seed permission catalog, roles, role-permission mappings, and test
    user-role assignments. Returns the role objects keyed by slug."""
    for pid, desc, cat in ALL_PERMISSIONS:
        db_session.add(Permission(id=pid, description=desc, category=cat))
    db_session.flush()

    admin_role = Role(slug="admin", name="Administrator")
    wm_role = Role(slug="warehouse_manager", name="Warehouse Manager")
    po_role = Role(slug="procurement_officer", name="Procurement Officer")
    auditor_role = Role(slug="auditor", name="Auditor")
    db_session.add_all([admin_role, wm_role, po_role, auditor_role])
    db_session.flush()

    # Admin → all permissions.
    for pid, _, _ in ALL_PERMISSIONS:
        db_session.add(RolePermission(role_id=admin_role.id, permission_id=pid))

    # Warehouse Manager: inventory + outbound + dashboard + forecast + agent (scoped, no warehouse.global).
    wm_perms = [
        "inventory.read", "inventory.write", "inventory.product.create",
        "outbound.sales_order.create", "outbound.transfer.create",
        "outbound.pick_list.manage", "outbound.ship.manage",
        "dashboard.read", "forecast.read", "agent.invoke",
    ]
    for pid in wm_perms:
        db_session.add(RolePermission(role_id=wm_role.id, permission_id=pid))

    # Procurement Officer: procurement + inventory.read + inventory.product.create + dashboard + forecast + agent.
    po_perms = [
        "inventory.read", "inventory.product.create",
        "procurement.supplier.create", "procurement.order.create",
        "procurement.order.receive",
        "dashboard.read", "forecast.read", "agent.invoke",
    ]
    for pid in po_perms:
        db_session.add(RolePermission(role_id=po_role.id, permission_id=pid))

    # Auditor: read-only + warehouse.global.
    for pid in ["inventory.read", "dashboard.read", "forecast.read", "warehouse.global"]:
        db_session.add(RolePermission(role_id=auditor_role.id, permission_id=pid))
    db_session.flush()

    # User-role assignments.
    db_session.add_all([
        UserRole(user_id=ADMIN_USER, role_id=admin_role.id),
        UserRole(user_id=NAIROBI_MANAGER_USER, role_id=wm_role.id),
        UserRole(user_id=AUDITOR_USER, role_id=auditor_role.id),
    ])
    db_session.flush()

    return {
        "admin": admin_role,
        "warehouse_manager": wm_role,
        "procurement_officer": po_role,
        "auditor": auditor_role,
    }


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
    to Nairobi only. Also seeds permission tables so require_permission() works."""
    _seed_permissions_and_roles(db_session)

    nairobi = Warehouse(name="Nairobi Central")
    mombasa = Warehouse(name="Mombasa Port")
    widget = Product(sku="SKU-1", name="Widget", category="Parts", unit_cost=Decimal("10.00"))
    gadget = Product(sku="SKU-2", name="Gadget", category="Parts", unit_cost=Decimal("25.00"))
    supplier = Supplier(name="Acme", lead_time_days=5, contact_email="a@acme.test")
    db_session.add_all([nairobi, mombasa, widget, gadget, supplier])
    db_session.flush()

    db_session.add_all(
        [
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
        UserWarehouseAssignment(user_id=NAIROBI_MANAGER_USER, warehouse_id=nairobi.id)
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
