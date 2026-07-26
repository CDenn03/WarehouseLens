"""Platform admin endpoint tests.

Covers:
  1. Platform admin can list tenants (only non-platform ones).
  2. Tenant CRUD: create provisions the first admin, update, delete + guards.
  3. Platform admin CRUD: provision by email, promote by id, update, reset,
     revoke (with the self-lockout guard).
  4. Non-platform-admin is rejected (403) from all platform endpoints.

Keycloak is stubbed: ``fake_keycloak`` replaces the admin-API calls with an
in-memory directory, so the tests exercise the provisioning *contract*
(the sub becomes the local user id, a temporary password comes back exactly
once) without a live identity provider.
"""
import uuid

import pytest

from app.core import keycloak_admin
from app.core.exceptions import UpstreamError
from app.core.permissions import ALL_PERMISSIONS, PERMISSION_CATEGORY
from app.core.permissions.roles import ROLE_DEFINITIONS, ROLE_NAMES
from app.models.authorization import Permission, Role, RolePermission, UserRole
from app.models.tenant import Tenant, User, UserTenant
from app.models.warehouse import Warehouse

TEMP_PASSWORD = "Changeme1"


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
    t = Tenant(name=name, admin_email=f"admin@{name}.local", is_platform=False)
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


# ── Fixtures ───────────────────────────────────────────────────────────────


class FakeKeycloak:
    """In-memory stand-in for the Keycloak admin API."""

    def __init__(self) -> None:
        self.users: dict[str, keycloak_admin.KeycloakUser] = {}
        self.password_resets: list[str] = []
        self._next_id = 1

    def provision_user(self, email: str, username: str | None = None):
        existing = self.find_user_by_email(email)
        if existing is not None:
            return keycloak_admin.ProvisionResult(
                user=existing, created=False, temporary_password=None
            )
        user = keycloak_admin.KeycloakUser(
            id=f"kc-sub-{self._next_id}",
            email=email,
            username=username or email.split("@")[0],
        )
        self._next_id += 1
        self.users[user.id] = user
        return keycloak_admin.ProvisionResult(
            user=user, created=True, temporary_password=TEMP_PASSWORD
        )

    def find_user_by_email(self, email: str):
        for user in self.users.values():
            if user.email.lower() == email.lower():
                return user
        return None

    def reset_password(self, user_id: str) -> str:
        self.password_resets.append(user_id)
        return TEMP_PASSWORD

    def update_user(self, user_id, *, email=None, username=None, enabled=None) -> None:
        current = self.users.get(user_id)
        if current is None:
            return
        self.users[user_id] = keycloak_admin.KeycloakUser(
            id=user_id,
            email=email or current.email,
            username=username or current.username,
            enabled=current.enabled if enabled is None else enabled,
        )

    def set_enabled(self, user_id: str, enabled: bool) -> None:
        self.update_user(user_id, enabled=enabled)


@pytest.fixture()
def fake_keycloak(monkeypatch) -> FakeKeycloak:
    fake = FakeKeycloak()
    for name in (
        "provision_user",
        "find_user_by_email",
        "reset_password",
        "update_user",
        "set_enabled",
    ):
        monkeypatch.setattr(keycloak_admin, name, getattr(fake, name))
    return fake


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


# ── Tenant reads ───────────────────────────────────────────────────────────


def test_list_tenants_excludes_platform(client, platform_seed):
    resp = client.get(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["platform_admin"].id),
    )
    assert resp.status_code == 200, resp.json()
    names = [t["name"] for t in resp.json()]
    assert "platform" not in names
    assert "acme" in names


# ── Tenant create ──────────────────────────────────────────────────────────


def test_create_tenant_provisions_admin(
    client, platform_seed, db_session, fake_keycloak
):
    """Creating a tenant creates its first user: a Keycloak account mirrored to
    the local users row, holding tenant_admin, with a one-time password."""
    resp = client.post(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["platform_admin"].id),
        json={"name": "beta-corp", "admin_email": "Admin@Beta.local"},
    )
    assert resp.status_code == 201, resp.json()
    body = resp.json()

    assert body["tenant"]["name"] == "beta-corp"
    assert body["tenant"]["is_platform"] is False
    assert body["tenant"]["admin_email"] == "admin@beta.local"
    assert body["admin"]["created"] is True
    assert body["admin"]["temporary_password"] == TEMP_PASSWORD

    admin_id = body["admin"]["user_id"]
    assert body["tenant"]["admin_user_id"] == admin_id

    # The local mirror is keyed by the Keycloak sub, so the first login reconciles.
    user = db_session.get(User, admin_id)
    assert user is not None and user.email == "admin@beta.local"

    role = db_session.query(Role).filter(Role.slug == "tenant_admin").one()
    assignment = (
        db_session.query(UserRole)
        .filter(
            UserRole.user_id == admin_id,
            UserRole.role_id == role.id,
            UserRole.tenant_id == uuid.UUID(body["tenant"]["id"]),
        )
        .one_or_none()
    )
    assert assignment is not None


def test_create_tenant_rejects_duplicate_name(client, platform_seed, fake_keycloak):
    resp = client.post(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["platform_admin"].id),
        json={"name": "ACME", "admin_email": "someone@acme.local"},
    )
    assert resp.status_code == 409, resp.json()


def test_create_tenant_requires_admin_email(client, platform_seed, fake_keycloak):
    resp = client.post(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["platform_admin"].id),
        json={"name": "gamma-corp"},
    )
    assert resp.status_code == 422, resp.json()


def test_reused_email_gets_no_new_password(client, platform_seed, fake_keycloak):
    """An address that already has an account keeps its existing password."""
    fake_keycloak.provision_user("existing@beta.local")

    resp = client.post(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["platform_admin"].id),
        json={"name": "delta-corp", "admin_email": "existing@beta.local"},
    )
    assert resp.status_code == 201, resp.json()
    assert resp.json()["admin"]["created"] is False
    assert resp.json()["admin"]["temporary_password"] is None


# ── Tenant update / delete ─────────────────────────────────────────────────


def test_update_tenant_renames(client, platform_seed, fake_keycloak):
    resp = client.patch(
        f"/api/v1/platform/tenants/{platform_seed['real_tenant'].id}",
        headers=_h(platform_seed["platform_admin"].id),
        json={"name": "acme-renamed"},
    )
    assert resp.status_code == 200, resp.json()
    assert resp.json()["tenant"]["name"] == "acme-renamed"
    assert resp.json()["admin"] is None


def test_update_tenant_admin_email_provisions_new_admin(
    client, platform_seed, db_session, fake_keycloak
):
    resp = client.patch(
        f"/api/v1/platform/tenants/{platform_seed['real_tenant'].id}",
        headers=_h(platform_seed["platform_admin"].id),
        json={"admin_email": "new.admin@acme.local"},
    )
    assert resp.status_code == 200, resp.json()
    body = resp.json()
    assert body["tenant"]["admin_email"] == "new.admin@acme.local"
    assert body["admin"]["temporary_password"] == TEMP_PASSWORD

    role = db_session.query(Role).filter(Role.slug == "tenant_admin").one()
    assert (
        db_session.query(UserRole)
        .filter(
            UserRole.user_id == body["admin"]["user_id"],
            UserRole.role_id == role.id,
            UserRole.tenant_id == platform_seed["real_tenant"].id,
        )
        .one_or_none()
        is not None
    )


def test_update_tenant_requires_a_field(client, platform_seed, fake_keycloak):
    resp = client.patch(
        f"/api/v1/platform/tenants/{platform_seed['real_tenant'].id}",
        headers=_h(platform_seed["platform_admin"].id),
        json={},
    )
    assert resp.status_code == 422, resp.json()


def test_delete_tenant_removes_membership(
    client, platform_seed, db_session, fake_keycloak
):
    tenant = platform_seed["real_tenant"]
    resp = client.delete(
        f"/api/v1/platform/tenants/{tenant.id}",
        headers=_h(platform_seed["platform_admin"].id),
    )
    assert resp.status_code == 204, resp.text

    assert db_session.get(Tenant, tenant.id) is None
    assert (
        db_session.query(UserTenant).filter(UserTenant.tenant_id == tenant.id).count()
        == 0
    )
    # The tenant's only member now belongs to no tenant → soft-deleted.
    assert db_session.get(User, platform_seed["tenant_admin"].id).deleted_at is not None


def test_delete_tenant_blocked_while_warehouses_exist(
    client, platform_seed, db_session, fake_keycloak
):
    db_session.add(Warehouse(name="Nairobi", tenant_id=platform_seed["real_tenant"].id))
    db_session.commit()

    resp = client.delete(
        f"/api/v1/platform/tenants/{platform_seed['real_tenant'].id}",
        headers=_h(platform_seed["platform_admin"].id),
    )
    assert resp.status_code == 409, resp.json()
    assert "warehouse" in resp.json()["detail"].lower()


def test_delete_platform_pseudo_tenant_is_404(client, platform_seed, fake_keycloak):
    resp = client.delete(
        f"/api/v1/platform/tenants/{platform_seed['platform_tenant'].id}",
        headers=_h(platform_seed["platform_admin"].id),
    )
    assert resp.status_code == 404, resp.json()


def test_reset_tenant_admin_password(client, platform_seed, fake_keycloak):
    create = client.post(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["platform_admin"].id),
        json={"name": "epsilon", "admin_email": "admin@epsilon.local"},
    )
    tenant_id = create.json()["tenant"]["id"]

    resp = client.post(
        f"/api/v1/platform/tenants/{tenant_id}/admin/reset-password",
        headers=_h(platform_seed["platform_admin"].id),
    )
    assert resp.status_code == 200, resp.json()
    assert resp.json()["temporary_password"] == TEMP_PASSWORD
    assert fake_keycloak.password_resets == [create.json()["admin"]["user_id"]]


# ── Platform admin CRUD ────────────────────────────────────────────────────


def test_create_platform_admin_by_email(client, platform_seed, fake_keycloak):
    resp = client.post(
        "/api/v1/platform/admins",
        headers=_h(platform_seed["platform_admin"].id),
        json={"email": "second@platform.local"},
    )
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["created"] is True
    assert body["temporary_password"] == TEMP_PASSWORD
    assert body["admin"]["email"] == "second@platform.local"

    listed = client.get(
        "/api/v1/platform/admins", headers=_h(platform_seed["platform_admin"].id)
    ).json()
    assert body["admin"]["id"] in [a["id"] for a in listed]


def test_create_platform_admin_by_user_id(client, platform_seed, fake_keycloak):
    """Promote someone who has already signed in."""
    resp = client.post(
        "/api/v1/platform/admins",
        headers=_h(platform_seed["platform_admin"].id),
        json={"user_id": platform_seed["tenant_admin"].id},
    )
    assert resp.status_code == 201, resp.json()
    assert resp.json()["temporary_password"] is None


def test_create_platform_admin_rejects_both_identifiers(
    client, platform_seed, fake_keycloak
):
    resp = client.post(
        "/api/v1/platform/admins",
        headers=_h(platform_seed["platform_admin"].id),
        json={"email": "x@y.local", "user_id": "abc"},
    )
    assert resp.status_code == 422, resp.json()


def test_create_platform_admin_duplicate_rejected(client, platform_seed, fake_keycloak):
    client.post(
        "/api/v1/platform/admins",
        headers=_h(platform_seed["platform_admin"].id),
        json={"email": "dupe@platform.local"},
    )
    resp = client.post(
        "/api/v1/platform/admins",
        headers=_h(platform_seed["platform_admin"].id),
        json={"email": "dupe@platform.local"},
    )
    assert resp.status_code == 409, resp.json()


def test_update_platform_admin(client, platform_seed, fake_keycloak):
    created = client.post(
        "/api/v1/platform/admins",
        headers=_h(platform_seed["platform_admin"].id),
        json={"email": "editable@platform.local"},
    ).json()
    user_id = created["admin"]["id"]

    resp = client.patch(
        f"/api/v1/platform/admins/{user_id}",
        headers=_h(platform_seed["platform_admin"].id),
        json={"email": "renamed@platform.local", "username": "renamed"},
    )
    assert resp.status_code == 200, resp.json()
    assert resp.json()["email"] == "renamed@platform.local"
    # Keycloak is the identity authority — the mirror must follow it.
    assert fake_keycloak.users[user_id].email == "renamed@platform.local"


def test_update_non_admin_is_404(client, platform_seed, fake_keycloak):
    resp = client.patch(
        f"/api/v1/platform/admins/{platform_seed['tenant_admin'].id}",
        headers=_h(platform_seed["platform_admin"].id),
        json={"username": "nope"},
    )
    assert resp.status_code == 404, resp.json()


def test_reset_platform_admin_password(client, platform_seed, fake_keycloak):
    resp = client.post(
        f"/api/v1/platform/admins/{platform_seed['platform_admin'].id}/reset-password",
        headers=_h(platform_seed["platform_admin"].id),
    )
    assert resp.status_code == 200, resp.json()
    assert resp.json()["temporary_password"] == TEMP_PASSWORD


# ── Authorization ──────────────────────────────────────────────────────────


def test_tenant_admin_cannot_access_platform_endpoints(client, platform_seed):
    resp = client.get(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["tenant_admin"].id),
    )
    assert resp.status_code == 403, resp.json()


def test_tenant_admin_cannot_delete_tenants(client, platform_seed):
    resp = client.delete(
        f"/api/v1/platform/tenants/{platform_seed['real_tenant'].id}",
        headers=_h(platform_seed["tenant_admin"].id),
    )
    assert resp.status_code == 403, resp.json()


def test_unauthenticated_rejected(client, platform_seed):
    resp = client.get("/api/v1/platform/tenants")
    assert resp.status_code == 401


# ── Self-lockout ───────────────────────────────────────────────────────────


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
    assert resp.status_code == 204, resp.text


# ── Keycloak failures surface as 502, not 500 ──────────────────────────────


def test_keycloak_outage_returns_502(client, platform_seed, monkeypatch):
    def boom(*_args, **_kwargs):
        raise UpstreamError("Could not reach Keycloak")

    monkeypatch.setattr(keycloak_admin, "provision_user", boom)

    resp = client.post(
        "/api/v1/platform/tenants",
        headers=_h(platform_seed["platform_admin"].id),
        json={"name": "zeta-corp", "admin_email": "admin@zeta.local"},
    )
    assert resp.status_code == 502, resp.json()
