"""Permission-driven dashboard routing.

Which dashboard a user lands on is decided by the dashboard.* namespace, not by
role slug.  These tests pin the precedence rule, the grants that back it, and
the tenant dashboard endpoint the rule routes to.
"""
from datetime import datetime

import pytest

from app.core.permissions.dashboard import (
    DASHBOARD_PLATFORM,
    DASHBOARD_READ,
    DASHBOARD_TENANT,
    resolve_dashboard,
)
from app.core.permissions.roles import ROLE_DEFINITIONS
from app.models import Tenant, User, UserRole, UserTenant, Warehouse

from tests.conftest import ADMIN, NAIROBI_MANAGER

TENANT_ADMIN_USER = "sub-tenant-admin"
TENANT_ADMIN = {"X-Debug-User": f"{TENANT_ADMIN_USER}:tenant.admin:placeholder"}


@pytest.fixture()
def tenant_admin(db_session, seeded):
    """Attach a tenant_admin user to the seeded tenant."""
    db_session.add(
        User(id=TENANT_ADMIN_USER, email="ta@test.local", username="tenant.admin")
    )
    db_session.add(UserTenant(user_id=TENANT_ADMIN_USER, tenant_id=seeded["tenant"].id))
    db_session.add(
        UserRole(
            user_id=TENANT_ADMIN_USER,
            role_id=seeded["roles"]["tenant_admin"].id,
            tenant_id=seeded["tenant"].id,
        )
    )
    db_session.commit()
    return seeded


# ── Precedence ────────────────────────────────────────────────────────

class TestResolveDashboard:
    def test_platform_outranks_everything(self):
        assert resolve_dashboard(
            {DASHBOARD_PLATFORM, DASHBOARD_TENANT, DASHBOARD_READ}
        ) == "platform"

    def test_tenant_outranks_operations(self):
        assert resolve_dashboard({DASHBOARD_TENANT, DASHBOARD_READ}) == "tenant"

    def test_operations_is_the_floor(self):
        assert resolve_dashboard({DASHBOARD_READ}) == "operations"

    def test_no_dashboard_permission_returns_none(self):
        """A user with permissions but no dashboard.* gets no landing page."""
        assert resolve_dashboard({"inventory.read", "iam.user.read"}) is None

    def test_empty_permissions_returns_none(self):
        assert resolve_dashboard(set()) is None


# ── Grants backing the routing ────────────────────────────────────────

class TestDashboardGrants:
    def test_tenant_admin_gets_tenant_dashboard(self):
        assert DASHBOARD_TENANT in ROLE_DEFINITIONS["tenant_admin"]

    def test_tenant_admin_has_no_operational_dashboard(self):
        """tenant_admin holds no inventory permissions, so the operational
        dashboard would 403 on every query — it must not be routed there."""
        assert DASHBOARD_READ not in ROLE_DEFINITIONS["tenant_admin"]

    def test_operational_admin_keeps_operations_dashboard(self):
        """admin must not pick up dashboard.tenant: it outranks dashboard.read
        and would land them on a page whose IAM data they cannot read."""
        assert DASHBOARD_TENANT not in ROLE_DEFINITIONS["admin"]
        assert DASHBOARD_READ in ROLE_DEFINITIONS["admin"]

    def test_exactly_one_role_per_dashboard_kind(self):
        holders = {
            slug
            for slug, perms in ROLE_DEFINITIONS.items()
            if DASHBOARD_TENANT in perms
        }
        assert holders == {"tenant_admin"}


# ── /auth/me reports the resolved dashboard ───────────────────────────

class TestAuthMeDashboard:
    def test_admin_routed_to_operations(self, client, seeded):
        body = client.get("/api/v1/auth/me", headers=ADMIN).json()
        assert body["dashboard"] == "operations"
        assert DASHBOARD_READ in body["permissions"]

    def test_tenant_admin_routed_to_tenant(self, client, tenant_admin):
        body = client.get("/api/v1/auth/me", headers=TENANT_ADMIN).json()
        assert body["dashboard"] == "tenant"
        assert DASHBOARD_TENANT in body["permissions"]

    def test_permissions_are_tenant_scoped(self, client, tenant_admin):
        """The reported permission set is exactly the role's — no leakage."""
        body = client.get("/api/v1/auth/me", headers=TENANT_ADMIN).json()
        assert set(body["permissions"]) == ROLE_DEFINITIONS["tenant_admin"]


# ── /dashboard/tenant ─────────────────────────────────────────────────

class TestTenantDashboardEndpoint:
    def test_requires_dashboard_tenant(self, client, seeded):
        """warehouse_manager holds dashboard.read, not dashboard.tenant."""
        r = client.get("/api/v1/dashboard/tenant", headers=NAIROBI_MANAGER)
        assert r.status_code == 403

    def test_operational_admin_is_denied(self, client, seeded):
        assert client.get("/api/v1/dashboard/tenant", headers=ADMIN).status_code == 403

    def test_tenant_admin_allowed(self, client, tenant_admin):
        r = client.get("/api/v1/dashboard/tenant", headers=TENANT_ADMIN)
        assert r.status_code == 200

    def test_counts_reflect_the_tenant(self, client, tenant_admin):
        body = client.get("/api/v1/dashboard/tenant", headers=TENANT_ADMIN).json()
        # conftest seeds 3 users + the tenant admin added by the fixture.
        assert body["user_count"] == 4
        # Nairobi Central + Mombasa Port.
        assert body["warehouse_count"] == 2
        # admin, warehouse_manager, auditor, tenant_admin are all assigned.
        assert body["role_count"] == 4

    def test_activity_lists_role_assignments(self, client, tenant_admin):
        body = client.get("/api/v1/dashboard/tenant", headers=TENANT_ADMIN).json()
        targets = {(e["kind"], e["target"]) for e in body["recent_activity"]}
        assert ("role", "Tenant Admin") in targets
        assert ("warehouse", "Nairobi Central") in targets

    def test_excludes_other_tenants(self, client, db_session, tenant_admin):
        """A second tenant's users and warehouses must not be counted."""
        other = Tenant(name="other", admin_email="o@test.local")
        db_session.add(other)
        db_session.flush()
        db_session.add(User(id="sub-other", email="o@test.local", username="other"))
        db_session.add(UserTenant(user_id="sub-other", tenant_id=other.id))
        db_session.add(Warehouse(name="Other Depot", tenant_id=other.id))
        db_session.commit()

        body = client.get("/api/v1/dashboard/tenant", headers=TENANT_ADMIN).json()
        assert body["user_count"] == 4
        assert body["warehouse_count"] == 2
        assert all("Other Depot" != e["target"] for e in body["recent_activity"])

    def test_soft_deleted_users_are_excluded(self, client, db_session, tenant_admin):
        user = db_session.query(User).filter(User.id == "sub-auditor").one()
        user.deleted_at = datetime.utcnow()
        db_session.commit()

        body = client.get("/api/v1/dashboard/tenant", headers=TENANT_ADMIN).json()
        assert body["user_count"] == 3
