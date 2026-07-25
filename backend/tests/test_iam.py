"""IAM endpoint tests — the four required cases plus happy-path smoke tests.

Required tests:
  1. Assigning a warehouse from a different tenant is rejected.
  2. Revoking the last IAM_USER_ROLE_ASSIGN holder is rejected unless another
     user in the tenant still holds it.
  3. A soft-deleted user cannot be assigned a new role or warehouse.
  4. A user with warehouse.global and zero user_warehouses rows still passes
     enforce_warehouse_scope() for any warehouse in their tenant.
"""

import uuid

import pytest

from app.core.permissions.roles import ROLE_DEFINITIONS
from app.models.authorization import Permission, Role, RolePermission, UserRole
from app.models.tenant import Tenant, User, UserTenant
from app.models.warehouse import UserWarehouseAssignment, Warehouse
from app.core.permissions import ALL_PERMISSIONS, PERMISSION_CATEGORY
from app.core.permissions.roles import ROLE_NAMES
from datetime import datetime, timezone


# ── Fixture helpers ────────────────────────────────────────────────────────


def _make_tenant(db, name="alpha") -> Tenant:
    t = Tenant(name=name, superuser_email=f"{name}@test.local")
    db.add(t)
    db.flush()
    return t


def _make_user(db, tenant: Tenant, sub: str, deleted: bool = False) -> User:
    u = User(id=sub, email=f"{sub}@test.local", username=sub)
    if deleted:
        u.deleted_at = datetime.now(timezone.utc)
    db.add(u)
    db.add(UserTenant(user_id=sub, tenant_id=tenant.id))
    db.flush()
    return u


def _seed_roles(db, tenant_id) -> dict[str, Role]:
    """Seed permission catalog + all roles into DB, return role slug→Role."""
    for pid, desc in ALL_PERMISSIONS.items():
        db.add(Permission(id=pid, description=desc, category=PERMISSION_CATEGORY[pid]))
    db.flush()

    roles: dict[str, Role] = {}
    for slug in ROLE_DEFINITIONS:
        r = Role(slug=slug, name=ROLE_NAMES[slug])
        db.add(r)
        db.flush()
        roles[slug] = r
        for pid in ROLE_DEFINITIONS[slug]:
            db.add(RolePermission(role_id=r.id, permission_id=pid))
    db.flush()
    return roles


def _assign_role(db, user_id: str, role: Role, tenant_id) -> UserRole:
    ur = UserRole(user_id=user_id, role_id=role.id, tenant_id=tenant_id)
    db.add(ur)
    db.flush()
    return ur


IAM_ADMIN_HEADER = lambda sub: {"X-Debug-User": f"{sub}:{sub}:placeholder"}


# ── Test 1: cross-tenant warehouse assignment is rejected ──────────────────


def test_assign_warehouse_from_different_tenant_is_rejected(client, db_session):
    """POST /iam/users/{id}/warehouses with a warehouse from tenant B while
    acting in tenant A must return 403."""
    tenant_a = _make_tenant(db_session, "tenant-a")
    tenant_b = _make_tenant(db_session, "tenant-b")

    roles = _seed_roles(db_session, tenant_a.id)

    # Actor: admin in tenant A (admin has warehouse.assign_user).
    actor_sub = "actor-wh-admin"
    _make_user(db_session, tenant_a, actor_sub)
    _assign_role(db_session, actor_sub, roles["admin"], tenant_a.id)

    # Target user: also in tenant A.
    target_sub = "target-user"
    _make_user(db_session, tenant_a, target_sub)
    _assign_role(db_session, target_sub, roles["warehouse_manager"], tenant_a.id)

    # Warehouse belongs to tenant B — not tenant A.
    wh_b = Warehouse(name="Cross-tenant WH", tenant_id=tenant_b.id)
    db_session.add(wh_b)
    db_session.commit()

    response = client.post(
        f"/api/v1/iam/users/{target_sub}/warehouses",
        headers=IAM_ADMIN_HEADER(actor_sub),
        json={"warehouse_id": str(wh_b.id)},
    )
    assert response.status_code == 403, response.json()
    assert "cross-tenant" in response.json()["detail"].lower()


# ── Test 2: self-lockout protection ────────────────────────────────────────


def test_revoke_last_iam_role_assign_holder_is_rejected(client, db_session):
    """DELETE /iam/users/{id}/roles/tenant_admin when the target is the only user
    holding IAM_USER_ROLE_ASSIGN in the tenant must return 403."""
    tenant = _make_tenant(db_session, "lockout-tenant")
    roles = _seed_roles(db_session, tenant.id)

    # Single iam_admin — after revocation no one can manage roles.
    only_admin_sub = "only-iam-admin"
    _make_user(db_session, tenant, only_admin_sub)
    _assign_role(db_session, only_admin_sub, roles["tenant_admin"], tenant.id)
    db_session.commit()

    response = client.delete(
        f"/api/v1/iam/users/{only_admin_sub}/roles/tenant_admin",
        headers=IAM_ADMIN_HEADER(only_admin_sub),
    )
    assert response.status_code == 403, response.json()
    assert "last user" in response.json()["detail"].lower()


def test_revoke_iam_role_allowed_when_another_holder_exists(client, db_session):
    """DELETE succeeds when a second user holds IAM_USER_ROLE_ASSIGN."""
    tenant = _make_tenant(db_session, "two-admins-tenant")
    roles = _seed_roles(db_session, tenant.id)

    admin_a = "admin-a"
    admin_b = "admin-b"
    _make_user(db_session, tenant, admin_a)
    _make_user(db_session, tenant, admin_b)
    _assign_role(db_session, admin_a, roles["tenant_admin"], tenant.id)
    _assign_role(db_session, admin_b, roles["tenant_admin"], tenant.id)
    db_session.commit()

    # admin_a revokes its own iam_admin — admin_b still holds it, so 204.
    response = client.delete(
        f"/api/v1/iam/users/{admin_a}/roles/tenant_admin",
        headers=IAM_ADMIN_HEADER(admin_a),
    )
    assert response.status_code == 204, response.json()


# ── Test 3: soft-deleted user cannot receive assignments ───────────────────


def test_deleted_user_cannot_be_assigned_role(client, db_session):
    """POST /iam/users/{id}/roles returns 409 when the target is soft-deleted."""
    tenant = _make_tenant(db_session, "del-role-tenant")
    roles = _seed_roles(db_session, tenant.id)

    actor_sub = "actor-for-del-role"
    _make_user(db_session, tenant, actor_sub)
    _assign_role(db_session, actor_sub, roles["tenant_admin"], tenant.id)

    deleted_sub = "deleted-user-role"
    _make_user(db_session, tenant, deleted_sub, deleted=True)
    db_session.commit()

    response = client.post(
        f"/api/v1/iam/users/{deleted_sub}/roles",
        headers=IAM_ADMIN_HEADER(actor_sub),
        json={"role_slug": "warehouse_manager"},
    )
    assert response.status_code == 409, response.json()
    assert "soft-deleted" in response.json()["detail"].lower()


def test_deleted_user_cannot_be_assigned_warehouse(client, db_session):
    """POST /iam/users/{id}/warehouses returns 409 when the user is soft-deleted."""
    tenant = _make_tenant(db_session, "del-wh-tenant")
    roles = _seed_roles(db_session, tenant.id)

    actor_sub = "actor-for-del-wh"
    _make_user(db_session, tenant, actor_sub)
    _assign_role(db_session, actor_sub, roles["admin"], tenant.id)

    deleted_sub = "deleted-user-wh"
    _make_user(db_session, tenant, deleted_sub, deleted=True)

    wh = Warehouse(name="Test WH del", tenant_id=tenant.id)
    db_session.add(wh)
    db_session.commit()

    response = client.post(
        f"/api/v1/iam/users/{deleted_sub}/warehouses",
        headers=IAM_ADMIN_HEADER(actor_sub),
        json={"warehouse_id": str(wh.id)},
    )
    assert response.status_code == 409, response.json()
    assert "soft-deleted" in response.json()["detail"].lower()


# ── Test 4: warehouse.global bypasses warehouse-scope checks ──────────────


def test_global_warehouse_user_passes_scope_with_zero_assignments(
    client, db_session
):
    """A user with warehouse.global and no rows in user_warehouse_assignments
    must still be allowed to query any warehouse in their tenant
    (enforce_warehouse_scope returns without error).

    Verify via GET /api/v1/dashboard/kpis with an explicit warehouse_id — the
    auditor role carries warehouse.global.
    """
    tenant = _make_tenant(db_session, "global-wh-tenant")
    roles = _seed_roles(db_session, tenant.id)

    # Auditor has warehouse.global but we intentionally add zero warehouse rows.
    auditor_sub = "zero-assignment-auditor"
    _make_user(db_session, tenant, auditor_sub)
    _assign_role(db_session, auditor_sub, roles["auditor"], tenant.id)

    # A warehouse in the same tenant.
    wh = Warehouse(name="Scope Test WH", tenant_id=tenant.id)
    db_session.add(wh)
    db_session.commit()

    # Confirm zero assignment rows.
    assignment_count = db_session.query(UserWarehouseAssignment).filter_by(
        user_id=auditor_sub
    ).count()
    assert assignment_count == 0

    # Dashboard KPI endpoint calls enforce_warehouse_scope internally.
    response = client.get(
        "/api/v1/dashboard/kpis",
        headers=IAM_ADMIN_HEADER(auditor_sub),
        params={"warehouse_id": str(wh.id)},
    )
    # 200 means enforce_warehouse_scope passed; 403 would mean the check failed.
    assert response.status_code == 200, response.json()
