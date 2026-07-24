"""Test fixtures: SQLite in-memory DB (the models are dialect-portable by
design) + FastAPI TestClient with the get_db dependency overridden.

Auth in tests goes through the X-Debug-User header the security scaffold
accepts ("sub:username:perm1|perm2") — permission-based, not role-based.
The permission tables must be seeded for require_permission() to resolve.

Tenant scoping: tests seed a "default" tenant. All warehouses, roles,
and assignments are scoped to that tenant.
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
from app.core.permissions import ALL_PERMISSIONS, PERMISSION_CATEGORY
from app.core.permissions.roles import ROLE_DEFINITIONS, ROLE_NAMES
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
from app.models.tenant import Tenant, User, UserTenant

# ── Test user IDs ──────────────────────────────────────────────────────

ADMIN_USER = "sub-admin"
AUDITOR_USER = "sub-auditor"
NAIROBI_MANAGER_USER = "sub-nai-mgr"

# ── Headers (permissions are resolved from DB, but this is the identity) ─

ADMIN = {"X-Debug-User": f"{ADMIN_USER}:admin:placeholder"}
AUDITOR = {"X-Debug-User": f"{AUDITOR_USER}:auditor:placeholder"}
NAIROBI_MANAGER = {"X-Debug-User": f"{NAIROBI_MANAGER_USER}:nai.manager:placeholder"}


def _seed_tenant(db_session) -> Tenant:
    """Create the default tenant."""
    tenant = Tenant(
        name="default",
        superuser_email="admin@test.local",
    )
    db_session.add(tenant)
    db_session.flush()
    return tenant


def _seed_users(db_session, tenant: Tenant):
    """Create user rows + tenant memberships for all test users."""
    for sub in [ADMIN_USER, AUDITOR_USER, NAIROBI_MANAGER_USER]:
        db_session.add(User(id=sub, email=f"{sub}@test.local", username=sub))
        db_session.add(UserTenant(user_id=sub, tenant_id=tenant.id))
    db_session.flush()


def _seed_permissions_and_roles(db_session, tenant_id) -> dict[str, Role]:
    """Seed permission catalog, roles, role-permission mappings, and test
    user-role assignments. Returns the role objects keyed by slug."""
    # Seed permissions from the code-level catalog.
    for pid, desc in ALL_PERMISSIONS.items():
        db_session.add(Permission(id=pid, description=desc, category=PERMISSION_CATEGORY[pid]))
    db_session.flush()

    # Seed roles.
    roles: dict[str, Role] = {}
    for slug in ROLE_DEFINITIONS:
        db_session.add(Role(slug=slug, name=ROLE_NAMES[slug]))
    db_session.flush()

    # Look up role objects and seed role_permissions from ROLE_DEFINITIONS.
    for slug, perms in ROLE_DEFINITIONS.items():
        role = db_session.query(Role).filter(Role.slug == slug).one()
        roles[slug] = role
        for pid in perms:
            db_session.add(RolePermission(role_id=role.id, permission_id=pid))
    db_session.flush()

    # User-role assignments (scoped to tenant).
    db_session.add_all([
        UserRole(user_id=ADMIN_USER, role_id=roles["admin"].id, tenant_id=tenant_id),
        UserRole(user_id=NAIROBI_MANAGER_USER, role_id=roles["warehouse_manager"].id, tenant_id=tenant_id),
        UserRole(user_id=AUDITOR_USER, role_id=roles["auditor"].id, tenant_id=tenant_id),
    ])
    db_session.flush()

    return roles


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
    to Nairobi only. Also seeds permission and tenant tables so
    require_permission() and resolve_tenant_id() work."""
    tenant = _seed_tenant(db_session)
    _seed_users(db_session, tenant)
    roles = _seed_permissions_and_roles(db_session, tenant.id)

    nairobi = Warehouse(name="Nairobi Central", tenant_id=tenant.id)
    mombasa = Warehouse(name="Mombasa Port", tenant_id=tenant.id)
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
        "tenant": tenant,
        "roles": roles,
    }


@pytest.fixture()
def today() -> str:
    return date.today().isoformat()
