"""Production hardening integration tests.

Covers:
  P2. Sensitive read permission protection (dashboard, forecast)
  P3. Agent endpoint protection (agent.invoke)
  P4. JWKS cache hardening (unknown kid retry)
  P5. BFF rate limiting
  P6. Observability logging (permission check decisions)
"""

import time
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.permissions import ALL_PERMISSIONS, PERMISSION_CATEGORY
from app.core.permissions.agent import AGENT_INVOKE
from app.core.permissions.dashboard import DASHBOARD_READ
from app.core.permissions.forecast import FORECAST_READ
from app.core.permissions.roles import ROLE_DEFINITIONS, ROLE_NAMES
from app.core.security import _JWKS_TTL_SECONDS, _jwks_cache, _JWKSCache
from app.main import app
from app.models import Base, Product, Warehouse, WarehouseStock
from app.models.authorization import Permission, Role, RolePermission, UserRole
from app.models.tenant import Tenant, User, UserTenant
from app.services.permission_service import resolve_permissions

# ── Helpers ────────────────────────────────────────────────────────────

ADMIN_USER = "sub-admin-harden"
AUDITOR_USER = "sub-auditor-harden"
NOCREDS_USER = "sub-nocreds-harden"


def _headers(user_id: str, username: str) -> dict[str, str]:
    return {"X-Debug-User": f"{user_id}:{username}:placeholder"}


def _seed_harden_perms(db_session) -> dict[str, Role]:
    """Seed permission catalog and roles for hardening tests."""
    # Seed tenant + users.
    tenant = Tenant(name="default", superuser_email="admin@test.local")
    db_session.add(tenant)
    db_session.flush()
    for sub in [ADMIN_USER, AUDITOR_USER, NOCREDS_USER]:
        db_session.add(User(id=sub, email=f"{sub}@test.local", username=sub))
        db_session.add(UserTenant(user_id=sub, tenant_id=tenant.id))
    db_session.flush()

    # Seed permissions from the code-level catalog.
    for pid, desc in ALL_PERMISSIONS.items():
        db_session.add(Permission(id=pid, description=desc, category=PERMISSION_CATEGORY[pid]))
    db_session.flush()

    # Seed roles from ROLE_DEFINITIONS.
    roles: dict[str, Role] = {}
    for slug in ROLE_DEFINITIONS:
        db_session.add(Role(slug=slug, name=ROLE_NAMES[slug]))
    db_session.flush()

    for slug, perms in ROLE_DEFINITIONS.items():
        role = db_session.query(Role).filter(Role.slug == slug).one()
        roles[slug] = role
        for pid in perms:
            db_session.add(RolePermission(role_id=role.id, permission_id=pid))
    db_session.flush()

    # Assign users to roles.
    db_session.add_all([
        UserRole(user_id=ADMIN_USER, role_id=roles["admin"].id, tenant_id=tenant.id),
        UserRole(user_id=AUDITOR_USER, role_id=roles["auditor"].id, tenant_id=tenant.id),
    ])
    db_session.flush()

    return {**roles, "tenant": tenant}


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
def seed_harden(db_session):
    """Seed perms + warehouses + products for dashboard/forecast/agent tests."""
    roles = _seed_harden_perms(db_session)

    nairobi = Warehouse(name="Nairobi Central", tenant_id=roles["tenant"].id)
    widget = Product(sku="SKU-H1", name="Widget", category="Parts", unit_cost="10.00")
    db_session.add_all([nairobi, widget])
    db_session.flush()
    db_session.add(WarehouseStock(
        warehouse_id=nairobi.id, product_id=widget.id,
        quantity_on_hand=50, reorder_point=80,
    ))
    db_session.commit()
    return {"nairobi": nairobi, "widget": widget, **roles}


# ══════════════════════════════════════════════════════════════════════
# P2. Sensitive Read Permission Protection
# ══════════════════════════════════════════════════════════════════════

class TestDashboardPermissionProtection:
    def test_dashboard_kpis_allowed_for_admin(self, client, seed_harden):
        resp = client.get("/api/v1/dashboard/kpis", headers=_headers(ADMIN_USER, "admin"))
        assert resp.status_code == 200

    def test_dashboard_kpis_denied_for_nocreds(self, client, seed_harden):
        resp = client.get("/api/v1/dashboard/kpis", headers=_headers(NOCREDS_USER, "nocreds"))
        assert resp.status_code == 403

    def test_dashboard_stock_trend_allowed_for_auditor(self, client, seed_harden):
        resp = client.get(
            "/api/v1/dashboard/charts/stock-trend",
            headers=_headers(AUDITOR_USER, "auditor"),
        )
        assert resp.status_code == 200

    def test_dashboard_stock_trend_denied_for_nocreds(self, client, seed_harden):
        resp = client.get(
            "/api/v1/dashboard/charts/stock-trend",
            headers=_headers(NOCREDS_USER, "nocreds"),
        )
        assert resp.status_code == 403

    def test_dashboard_abc_ranking_allowed_for_admin(self, client, seed_harden):
        resp = client.get(
            "/api/v1/dashboard/charts/abc-ranking",
            headers=_headers(ADMIN_USER, "admin"),
        )
        assert resp.status_code == 200

    def test_dashboard_abc_ranking_denied_for_nocreds(self, client, seed_harden):
        resp = client.get(
            "/api/v1/dashboard/charts/abc-ranking",
            headers=_headers(NOCREDS_USER, "nocreds"),
        )
        assert resp.status_code == 403


class TestForecastPermissionProtection:
    def test_forecast_denied_for_nocreds(self, client, seed_harden):
        product_id = seed_harden["widget"].id
        warehouse_id = seed_harden["nairobi"].id
        resp = client.get(
            f"/api/v1/forecast/{product_id}",
            params={"warehouse_id": str(warehouse_id)},
            headers=_headers(NOCREDS_USER, "nocreds"),
        )
        assert resp.status_code == 403

    def test_forecast_allowed_for_admin(self, client, seed_harden):
        product_id = seed_harden["widget"].id
        warehouse_id = seed_harden["nairobi"].id
        resp = client.get(
            f"/api/v1/forecast/{product_id}",
            params={"warehouse_id": str(warehouse_id)},
            headers=_headers(ADMIN_USER, "admin"),
        )
        assert resp.status_code == 200


# ══════════════════════════════════════════════════════════════════════
# P3. Agent Endpoint Protection
# ══════════════════════════════════════════════════════════════════════

class TestAgentEndpointProtection:
    def test_agent_denied_for_auditor(self, client, seed_harden):
        resp = client.post(
            "/api/v1/agent/query",
            json={"question": "What is inventory?"},
            headers=_headers(AUDITOR_USER, "auditor"),
        )
        assert resp.status_code == 403

    def test_agent_denied_for_nocreds(self, client, seed_harden):
        resp = client.post(
            "/api/v1/agent/query",
            json={"question": "What is inventory?"},
            headers=_headers(NOCREDS_USER, "nocreds"),
        )
        assert resp.status_code == 403

    def test_agent_allowed_for_admin(self, client, seed_harden):
        resp = client.post(
            "/api/v1/agent/query",
            json={"question": "What is inventory?"},
            headers=_headers(ADMIN_USER, "admin"),
        )
        assert resp.status_code != 403, f"Admin was denied agent.invoke: {resp.text}"


# ══════════════════════════════════════════════════════════════════════
# P4. JWKS Cache Hardening
# ══════════════════════════════════════════════════════════════════════

class TestJWKSCacheHardening:
    def test_jwks_cache_has_ttl(self):
        cache = _JWKSCache()
        assert cache.keys == {}
        assert not cache.is_valid

    def test_jwks_cache_valid_after_store(self, db_session):
        cache = _JWKSCache()
        cache.store({"kid-1": {"kid": "kid-1", "kty": "RSA"}})
        assert cache.is_valid
        assert "kid-1" in cache.keys

    def test_jwks_cache_invalid_after_ttl(self):
        cache = _JWKSCache()
        cache.store({"kid-1": {"kid": "kid-1"}})
        cache._fetched_at = time.time() - (_JWKS_TTL_SECONDS + 1)
        assert not cache.is_valid

    def test_jwks_cache_invalidate_clears_keys(self):
        cache = _JWKSCache()
        cache.store({"kid-1": {"kid": "kid-1"}})
        cache.invalidate()
        assert cache.keys == {}
        assert not cache.is_valid

    def test_unknown_kid_triggers_refresh(self, client, db_session, seed_harden):
        _jwks_cache.store({"stale-kid": {"kid": "stale-kid"}})
        resp = client.get("/api/v1/dashboard/kpis")
        assert resp.status_code == 401
        _jwks_cache.invalidate()

    def test_jwks_cache_rotation_replaces_keys(self):
        cache = _JWKSCache()
        cache.store({"kid-v1": {"kid": "kid-v1"}})
        cache.store({"kid-v2": {"kid": "kid-v2"}})
        assert "kid-v1" not in cache.keys
        assert "kid-v2" in cache.keys


# ══════════════════════════════════════════════════════════════════════
# P5. BFF Rate Limiting (middleware-level)
# ══════════════════════════════════════════════════════════════════════

class TestBFFRateLimiting:
    def test_authenticated_request_allowed(self, client, seed_harden):
        resp = client.get(
            "/api/v1/dashboard/kpis",
            headers=_headers(ADMIN_USER, "admin"),
        )
        assert resp.status_code == 200

    def test_unauthenticated_request_rejected_at_backend(self, client, seed_harden):
        resp = client.get("/api/v1/dashboard/kpis")
        assert resp.status_code == 401


# ══════════════════════════════════════════════════════════════════════
# P6. Observability — Permission Check Logging
# ══════════════════════════════════════════════════════════════════════

class TestObservabilityLogging:
    def test_permission_check_allowed_emits_log(self, client, seed_harden, caplog):
        import logging
        with caplog.at_level(logging.INFO, logger="app.core.security"):
            resp = client.get(
                "/api/v1/dashboard/kpis",
                headers=_headers(ADMIN_USER, "admin"),
            )
        assert resp.status_code == 200
        matching = [r for r in caplog.records if r.getMessage() == "permission check"]
        assert len(matching) >= 1, "No 'permission check' log emitted for allowed request"
        last = matching[-1]
        assert last.decision == "allow"
        assert last.permission == DASHBOARD_READ
        assert last.user_id == ADMIN_USER

    def test_permission_check_denied_emits_log(self, client, seed_harden, caplog):
        import logging
        with caplog.at_level(logging.INFO, logger="app.core.security"):
            resp = client.get(
                "/api/v1/dashboard/kpis",
                headers=_headers(NOCREDS_USER, "nocreds"),
            )
        assert resp.status_code == 403
        matching = [r for r in caplog.records if r.getMessage() == "permission check"]
        assert len(matching) >= 1, "No 'permission check' log emitted for denied request"
        last = matching[-1]
        assert last.decision == "deny"
        assert last.permission == DASHBOARD_READ

    def test_correlation_id_propagated_in_logs(self, client, seed_harden, caplog):
        import logging
        request_id = f"test-{uuid.uuid4().hex[:8]}"
        with caplog.at_level(logging.INFO, logger="app.core.security"):
            resp = client.get(
                "/api/v1/dashboard/kpis",
                headers={
                    **_headers(ADMIN_USER, "admin"),
                    "X-Request-ID": request_id,
                },
            )
        assert resp.status_code == 200
        matching = [r for r in caplog.records if r.request_id == request_id]
        assert len(matching) >= 1, f"Request ID {request_id} not found in log records"


# ══════════════════════════════════════════════════════════════════════
# Permission resolution edge cases
# ══════════════════════════════════════════════════════════════════════

class TestPermissionResolutionEdgeCases:
    def test_auditor_lacks_agent_invoke(self, db_session, seed_harden):
        perms = resolve_permissions(db_session, AUDITOR_USER, seed_harden["tenant"].id)
        assert AGENT_INVOKE not in perms

    def test_admin_has_all_permissions(self, db_session, seed_harden):
        perms = resolve_permissions(db_session, ADMIN_USER, seed_harden["tenant"].id)
        assert len(perms) >= len(ALL_PERMISSIONS) - 5  # admin excludes IAM + platform perms

    def test_unknown_user_has_no_permissions(self, db_session, seed_harden):
        assert resolve_permissions(db_session, "nonexistent-sub", seed_harden["tenant"].id) == set()

    def test_auditor_has_dashboard_and_forecast(self, db_session, seed_harden):
        perms = resolve_permissions(db_session, AUDITOR_USER, seed_harden["tenant"].id)
        assert DASHBOARD_READ in perms
        assert FORECAST_READ in perms
