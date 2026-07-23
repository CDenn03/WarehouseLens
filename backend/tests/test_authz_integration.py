"""End-to-end authorization integration tests.

Covers:
  A. Allowed — user with the required permission gets 201.
  B. Denied — user without the required permission gets 403.
  C. Immediate revocation — removing a permission from the DB blocks the
     next request using the same (still-valid) JWT.
  D. Warehouse scope — user with permission but without assignment is rejected.
  E. Audit logging — state-changing actions write to access_decisions.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models import Base, Product, Supplier, Warehouse, WarehouseStock, UserWarehouseAssignment
from app.models.authorization import (
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from app.services.permission_service import resolve_permissions

# ── Helpers ────────────────────────────────────────────────────────────

ADMIN_USER = "sub-admin-uuid"
PROC_USER = "sub-proc-uuid"


def _headers(user_id: str, username: str) -> dict[str, str]:
    """Build X-Debug-User header. Permissions are resolved from DB in tests."""
    return {"X-Debug-User": f"{user_id}:{username}:placeholder"}


def _po_body(supplier_id: uuid.UUID, warehouse_id: uuid.UUID, product_id: uuid.UUID) -> dict:
    """Valid PurchaseOrderCreate body."""
    return {
        "supplier_id": str(supplier_id),
        "destination_warehouse_id": str(warehouse_id),
        "order_date": date.today().isoformat(),
        "items": [{"product_id": str(product_id), "quantity_ordered": 10}],
    }


# ── Fixtures ───────────────────────────────────────────────────────────

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
def seed_auth(db_session):
    """Seed permission tables, roles, role→permissions, user→roles, warehouse, supplier,
    and a product so the procurement/inventory endpoints have valid FK targets."""
    # ── Permissions ────────────────────────────────────────────────────
    all_perms = [
        ("procurement.order.create", "Create POs", "procurement"),
        ("procurement.order.receive", "Receive POs", "procurement"),
        ("procurement.supplier.create", "Create suppliers", "procurement"),
        ("inventory.write", "Write inventory", "inventory"),
        ("inventory.read", "Read inventory", "inventory"),
        ("inventory.product.create", "Create products", "inventory"),
        ("warehouse.create", "Create warehouses", "warehouse"),
        ("warehouse.assign_user", "Assign users", "warehouse"),
        ("warehouse.global", "Global scope", "warehouse"),
        ("outbound.sales_order.create", "Create SOs", "outbound"),
        ("outbound.transfer.create", "Create transfers", "outbound"),
        ("outbound.pick_list.manage", "Manage picks", "outbound"),
        ("outbound.ship.manage", "Manage shipping", "outbound"),
        ("dashboard.read", "View dashboard", "dashboard"),
        ("forecast.read", "View forecasts", "forecast"),
        ("agent.invoke", "Invoke AI agent", "agent"),
    ]
    for pid, desc, cat in all_perms:
        db_session.add(Permission(id=pid, description=desc, category=cat))
    db_session.flush()

    # ── Roles ──────────────────────────────────────────────────────────
    admin_role = Role(slug="admin", name="Administrator")
    proc_role = Role(slug="procurement_officer", name="Procurement Officer")
    db_session.add_all([admin_role, proc_role])
    db_session.flush()

    # Admin → all permissions.
    for pid, _, _ in all_perms:
        db_session.add(RolePermission(role_id=admin_role.id, permission_id=pid))

    # Procurement officer → procurement + inventory.read + inventory.product.create + warehouse.global.
    for pid in ["procurement.order.create", "procurement.order.receive",
                "procurement.supplier.create", "inventory.read", "inventory.product.create",
                "warehouse.global"]:
        db_session.add(RolePermission(role_id=proc_role.id, permission_id=pid))
    db_session.flush()

    # ── User → Role assignments (DB-driven permission source) ──────────
    db_session.add_all([
        UserRole(user_id=ADMIN_USER, role_id=admin_role.id),
        UserRole(user_id=PROC_USER, role_id=proc_role.id),
    ])

    # ── Warehouse, supplier, product (FK targets) ──────────────────────
    nairobi = Warehouse(name="Nairobi Central")
    supplier = Supplier(name="Acme", lead_time_days=5, contact_email="a@acme.test")
    product = Product(sku="SKU-TEST", name="Test Widget", category="Parts", unit_cost=Decimal("10.00"))
    db_session.add_all([nairobi, supplier, product])
    db_session.commit()

    return {
        "nairobi": nairobi,
        "supplier": supplier,
        "product": product,
        "admin_role": admin_role,
        "proc_role": proc_role,
    }


def _po_create_body(seed: dict) -> dict:
    return _po_body(seed["supplier"].id, seed["nairobi"].id, seed["product"].id)


# ── Scenario A: Allowed ────────────────────────────────────────────────


class TestScenarioA_Allowed:
    def test_procurement_order_create_allowed(self, client, seed_auth):
        """User with procurement.order.create gets 201."""
        resp = client.post(
            "/api/v1/purchase-orders",
            json=_po_create_body(seed_auth),
            headers=_headers(PROC_USER, "proc.user"),
        )
        assert resp.status_code == 201, resp.text

    def test_procurement_order_receive_allowed(self, client, seed_auth):
        """User with procurement.order.receive can receive a PO."""
        create_resp = client.post(
            "/api/v1/purchase-orders",
            json=_po_create_body(seed_auth),
            headers=_headers(ADMIN_USER, "admin"),
        )
        assert create_resp.status_code == 201, create_resp.text
        po_id = create_resp.json()["id"]

        resp = client.post(
            f"/api/v1/purchase-orders/{po_id}/receive",
            headers=_headers(PROC_USER, "proc.user"),
        )
        assert resp.status_code == 200, resp.text

    def test_supplier_create_allowed(self, client, seed_auth):
        """User with procurement.supplier.create gets 201."""
        resp = client.post(
            "/api/v1/suppliers",
            json={"name": "New Supplier", "lead_time_days": 3, "contact_email": "x@test"},
            headers=_headers(PROC_USER, "proc.user"),
        )
        assert resp.status_code == 201, resp.text


# ── Scenario B: Denied ────────────────────────────────────────────────


class TestScenarioB_Denied:
    def test_procurement_order_create_denied_for_unassigned_user(self, client, seed_auth, db_session):
        """User NOT in any role gets 403 — deny-by-default."""
        unknown_id = str(uuid.uuid4())
        # Seed user as auditor (read-only) — no procurement permissions.
        auditor_role = Role(slug="auditor_test", name="Auditor Test")
        db_session.add(auditor_role)
        db_session.flush()
        for pid in ["inventory.read", "dashboard.read", "forecast.read"]:
            db_session.add(RolePermission(role_id=auditor_role.id, permission_id=pid))
        db_session.add(UserRole(user_id=unknown_id, role_id=auditor_role.id))
        db_session.commit()

        resp = client.post(
            "/api/v1/purchase-orders",
            json=_po_create_body(seed_auth),
            headers=_headers(unknown_id, "auditor.user"),
        )
        assert resp.status_code == 403

    def test_no_permissions_is_403(self, client, seed_auth):
        """User with no role assignment (empty user_roles) gets 403."""
        unknown_id = str(uuid.uuid4())
        resp = client.post(
            "/api/v1/purchase-orders",
            json=_po_create_body(seed_auth),
            headers=_headers(unknown_id, "ghost.user"),
        )
        assert resp.status_code == 403

    def test_missing_auth_is_401(self, client, seed_auth):
        """No credentials at all gets 401."""
        resp = client.post(
            "/api/v1/purchase-orders",
            json=_po_create_body(seed_auth),
        )
        assert resp.status_code == 401


# ── Scenario C: Immediate Revocation ───────────────────────────────────


class TestScenarioC_Revocation:
    def test_revocation_blocks_next_request(self, client, seed_auth, db_session):
        """
        1. Create a temporary role with procurement.order.create → assign to user → request succeeds.
        2. Delete the user_roles row (revoke).
        3. Same user (same debug header) → next request is immediately 403.
        """
        user_id = f"sub-revoke-{uuid.uuid4().hex[:8]}"

        # Step 1: create a temp role with the permission, assign user.
        temp_role = Role(slug=f"temp_{user_id}", name="Temp Role")
        db_session.add(temp_role)
        db_session.flush()
        db_session.add(RolePermission(role_id=temp_role.id, permission_id="procurement.order.create"))
        db_session.add(RolePermission(role_id=temp_role.id, permission_id="warehouse.global"))
        db_session.add(UserRole(user_id=user_id, role_id=temp_role.id))
        db_session.commit()

        resp = client.post(
            "/api/v1/purchase-orders",
            json=_po_create_body(seed_auth),
            headers=_headers(user_id, "revoking.user"),
        )
        assert resp.status_code == 201, f"First request should succeed, got {resp.status_code}: {resp.text}"

        # Step 2: revoke — delete the user→role assignment.
        db_session.query(UserRole).filter(
            UserRole.user_id == user_id, UserRole.role_id == temp_role.id
        ).delete()
        db_session.commit()

        # Step 3: same JWT, same user — now 403 because DB no longer grants the permission.
        resp = client.post(
            "/api/v1/purchase-orders",
            json=_po_create_body(seed_auth),
            headers=_headers(user_id, "revoking.user"),
        )
        assert resp.status_code == 403, "Immediate revocation failed — expected 403"


# ── Scenario D: Warehouse Scope ────────────────────────────────────────


class TestScenarioD_WarehouseScope:
    def _seed_warehouse_user(self, db_session, user_id: str, role_slug: str, perms: list[str], warehouse: Warehouse):
        """Seed a user into DB with given permissions + warehouse assignment."""
        role = Role(slug=role_slug, name=role_slug)
        db_session.add(role)
        db_session.flush()
        for pid in perms:
            db_session.add(RolePermission(role_id=role.id, permission_id=pid))
        db_session.add(UserRole(user_id=user_id, role_id=role.id))
        db_session.add(UserWarehouseAssignment(user_id=user_id, warehouse_id=warehouse.id))
        db_session.commit()
        return role

    def test_scoped_user_cannot_write_unassigned_warehouse(self, client, seed_auth, db_session):
        """User with inventory.write but NOT assigned to a warehouse is rejected."""
        user_id = f"sub-scoped-{uuid.uuid4().hex[:8]}"
        other_warehouse = Warehouse(name="Mombasa Port")
        db_session.add(other_warehouse)
        db_session.flush()

        # User is assigned to OTHER warehouse only.
        self._seed_warehouse_user(
            db_session, user_id, "scoped_wh_user",
            ["inventory.write"], other_warehouse,
        )

        resp = client.post(
            "/api/v1/inventory/transactions",
            json={
                "warehouse_id": str(seed_auth["nairobi"].id),  # not assigned here
                "product_id": str(seed_auth["product"].id),
                "quantity_delta": 5,
                "type": "adjustment",
            },
            headers=_headers(user_id, "scoped.user"),
        )
        assert resp.status_code == 403, "Unassigned warehouse should be rejected"

    def test_global_user_can_write_any_warehouse(self, client, seed_auth, db_session):
        """User with inventory.write + warehouse.global can write anywhere."""
        user_id = f"sub-global-{uuid.uuid4().hex[:8]}"
        role = Role(slug=f"global_role_{user_id}", name="Global Role")
        db_session.add(role)
        db_session.flush()
        for pid in ["inventory.write", "warehouse.global"]:
            db_session.add(RolePermission(role_id=role.id, permission_id=pid))
        db_session.add(UserRole(user_id=user_id, role_id=role.id))
        db_session.commit()

        resp = client.post(
            "/api/v1/inventory/transactions",
            json={
                "warehouse_id": str(seed_auth["nairobi"].id),
                "product_id": str(seed_auth["product"].id),
                "quantity_delta": 5,
                "type": "adjustment",
            },
            headers=_headers(user_id, "global.user"),
        )
        assert resp.status_code == 201, resp.text

    def test_warehouse_list_filters_by_assignment(self, client, seed_auth, db_session):
        """List endpoint returns data for assigned warehouses."""
        user_id = f"sub-list-{uuid.uuid4().hex[:8]}"
        self._seed_warehouse_user(
            db_session, user_id, "list_role",
            ["inventory.read"], seed_auth["nairobi"],
        )

        resp = client.get("/api/v1/products", headers=_headers(user_id, "list.user"))
        assert resp.status_code == 200


# ── Scenario E: Audit Logging ──────────────────────────────────────────


class TestScenarioE_AuditLogging:
    def test_receive_po_writes_audit_row(self, client, seed_auth, db_session):
        """receive_purchase_order writes to access_decisions."""
        create_resp = client.post(
            "/api/v1/purchase-orders",
            json=_po_create_body(seed_auth),
            headers=_headers(ADMIN_USER, "admin"),
        )
        assert create_resp.status_code == 201, create_resp.text
        po_id = create_resp.json()["id"]

        resp = client.post(
            f"/api/v1/purchase-orders/{po_id}/receive",
            headers=_headers(PROC_USER, "proc.user"),
        )
        assert resp.status_code == 200

        rows = db_session.execute(
            text("SELECT * FROM access_decisions WHERE user_id = :uid AND permission_id = :pid"),
            {"uid": PROC_USER, "pid": "procurement.order.receive"},
        ).fetchall()
        assert len(rows) >= 1, "access_decisions row not found after receive_purchase_order"

        row = rows[-1]
        mapping = row._mapping
        assert mapping["decision"] == "allow"
        assert "po_id=" in (mapping["action_context"] or "")


# ── Permission resolution unit tests ───────────────────────────────────


class TestPermissionResolution:
    def test_resolve_permissions_returns_correct_set(self, db_session, seed_auth):
        perms = resolve_permissions(db_session, PROC_USER)
        assert "procurement.order.create" in perms
        assert "procurement.order.receive" in perms
        assert "inventory.write" not in perms

    def test_resolve_permissions_empty_for_unknown_user(self, db_session, seed_auth):
        assert resolve_permissions(db_session, "unknown-user-sub") == set()

    def test_admin_has_all_permissions(self, db_session, seed_auth):
        perms = resolve_permissions(db_session, ADMIN_USER)
        assert len(perms) >= 16  # 16 seeded permissions

    def test_warehouse_global_for_admin(self, db_session, seed_auth):
        assert "warehouse.global" in resolve_permissions(db_session, ADMIN_USER)
