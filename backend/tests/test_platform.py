"""Platform admin endpoint tests.

Covers:
  1. Platform admin can list tenants (only non-platform ones).
  2. Platform admin can create a tenant.
  3. Non-platform-admin is rejected (403) from all platform endpoints.
  4. Platform admin can assign/revoke platform_admin role; self-lockout blocked.
"""
import pytest

from app.core.permissions import ALL_PERMISSIONS, PERMISSION_CATEGORY
from app.core.permissions.roles import ROLE_DEFINITIONS, ROLE_NAMES
from app.models.authorization import Permission, Role, RolePermission, UserRole
from app.models.tenant import Tenant, User, UserTenant


# ── Helpers ────────────────────────────────────────────────────────────────


def _seed_roles(db) -> dict[str, Role]:
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


def _make_platform_tenant(db) -> Tenant:
    t = Tenant(name="platform", is_platform=True)
    db.add(t)
    db.flush()
    return t


def _make_real_tenant(db, name="acme") -> Tenant:
    t = Tenant(name=name, superuser_email=f"admin@{name}.local", is_platform=False)
    db.add(t)
    db.flush()
    return t


def _make_user(db, sub: str, tenant: Tenant, role: Role) -> User:
    u = User(id=sub, email=f"{sub}@test.local", username=sub)
    db.add(u)
    db.add(UserTenant(user_id=sub, tenant_id=tenant.id))
    db.add(UserRole(user_id=sub, role_id=role.id, tenant_id=tenant.id))
    db.flush()
    return u


def _h(sub: str) -> dict:
    return {"X-Debug-User": f"{sub}:{sub}:placeholder"}


# ── Fixture ────────────────────────────────────────────────────────────────


@pytest.fixture()
def platform_seed(db_session):
    roles = _seed_roles(db_session)
    platform_tenant = _make_platform_tenant(db_session)
    real_tenant = _make_real_tenant(db_session, "acme")

    platform_admin = _make_user(
        db_session, "platform-admin-1", platform_tenant, roles["platform_admin"]
    )
    # A regular tenant admin — should be denied platform endpoints.
    tenant_admin = _make_user(
        db_session, "tenant-admin-1", real_tenant, roles["tenant_admin"]
    )
    db_session.commit()
    return {
        "roles": roles,
        "platform_tenant": platform_tenant,
        "real_tenant": real_tenant,
        "platform_admin": platform_admin,
        "tenant_admin": tenant_admin,
    }


# ── Test 1: list tenants excludes platform pseudo-tenant ──────────────────


def test_list_tenants_excludes_platform(client, platform_seed):
    resp = client.get(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["platform_admin"].id),
    )
    assert resp.status_code == 200, resp.json()
    names = [t["name"] for t in resp.json()]
    assert "platform" not in names
    assert "acme" in names


# ── Test 2: platform admin can create a tenant ────────────────────────────


def test_create_tenant(client, platform_seed):
    resp = client.post(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["platform_admin"].id),
        json={"name": "beta-corp", "superuser_email": "admin@beta.local"},
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data["name"] == "beta-corp"
    assert data["is_platform"] is False


# ── Test 3: non-platform-admin is rejected ────────────────────────────────


def test_tenant_admin_cannot_access_platform_endpoints(client, platform_seed):
    resp = client.get(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["tenant_admin"].id),
    )
    assert resp.status_code == 403, resp.json()


def test_unauthenticated_rejected(client, platform_seed):
    resp = client.get("/api/v1/platform/tenants")
    assert resp.status_code == 401


# ── Test 4: platform admin self-lockout is blocked ────────────────────────


def test_revoke_last_platform_admin_blocked(client, platform_seed, db_session):
    """Revoking the only platform admin must return 409."""
    resp = client.delete(
        f"/api/v1/platform/admins/{platform_seed['platform_admin'].id}",
        headers=_h(platform_seed["platform_admin"].id),
    )
    assert resp.status_code == 409, resp.json()
    assert "last platform admin" in resp.json()["detail"].lower()


def test_revoke_platform_admin_allowed_when_another_exists(
    client, platform_seed, db_session
):
    """Revoke succeeds when a second platform admin exists."""
    # Add a second platform admin.
    second = User(id="platform-admin-2", email="pa2@test.local", username="pa2")
    db_session.add(second)
    db_session.add(
        UserTenant(user_id=second.id, tenant_id=platform_seed["platform_tenant"].id)
    )
    db_session.add(
        UserRole(
            user_id=second.id,
            role_id=platform_seed["roles"]["platform_admin"].id,
            tenant_id=platform_seed["platform_tenant"].id,
        )
    )
    db_session.commit()

    resp = client.delete(
        f"/api/v1/platform/admins/{platform_seed['platform_admin'].id}",
        headers=_h(platform_seed["platform_admin"].id),
    )
    assert resp.status_code == 204, resp.json()
