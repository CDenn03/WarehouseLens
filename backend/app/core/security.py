"""Auth & RBAC — migrated to permission-based authorization.

Authentication uses Keycloak JWTs verified against the realm's JWKS endpoint.
The dependency resolves identity via two sources (in priority order):
  1. ``X-Debug-User`` header — tests and local dev only (gated by environment).
  2. ``Authorization: Bearer`` header — Swagger UI / BFF proxy.

Authorization is permission-based: ``require_permission()`` resolves the
caller's permissions from the database and enforces deny-by-default.

Tenant scoping: every user belongs to one or more tenants.  Permissions are
resolved within the current tenant.  ``warehouse.global`` means "all warehouses
within my tenant," never across tenants.

JWKS cache has a 15-minute TTL and handles key rotation automatically.
"""

import logging
import time
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.correlation import get_request_id
from app.core.database import get_db
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.warehouse import UserWarehouseAssignment, Warehouse

from app.core.permissions.warehouse import WAREHOUSE_GLOBAL

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

# Permissions that grant global (all-warehouse) scope within a tenant.
_GLOBAL_PERMISSIONS = {WAREHOUSE_GLOBAL}

# JWKS cache TTL in seconds (15 minutes).
_JWKS_TTL_SECONDS = 15 * 60


@dataclass
class CurrentUser:
    """What the backend trusts about the caller, extracted from the Keycloak JWT.

    Fields:
      sub:        stable Keycloak subject identifier
      username:   human-readable preferred_username
      tenant_id:  resolved from user_tenants — the current tenant context
      permissions: resolved from the DB by require_permission() — never from JWT
    """

    sub: str
    username: str
    tenant_id: UUID | None = None
    permissions: set[str] = field(default_factory=set)


# ── JWKS cache with TTL ────────────────────────────────────────────────

class _JWKSCache:
    """Thread-safe JWKS cache with TTL-based expiry and automatic rotation."""

    def __init__(self) -> None:
        self._keys: dict[str, dict] = {}
        self._fetched_at: float = 0.0

    @property
    def keys(self) -> dict[str, dict]:
        return self._keys

    @property
    def is_valid(self) -> bool:
        return bool(self._keys) and (time.time() - self._fetched_at) < _JWKS_TTL_SECONDS

    def store(self, jwks: dict[str, dict]) -> None:
        self._keys = jwks
        self._fetched_at = time.time()

    def invalidate(self) -> None:
        self._keys = {}
        self._fetched_at = 0.0


_jwks_cache = _JWKSCache()


async def _fetch_jwks() -> dict[str, dict]:
    """Fetch Keycloak's public keys, cache by kid.

    Uses keycloak_internal_url when set (Docker deployments where the backend
    cannot reach the public hostname), otherwise falls back to keycloak_issuer_url.
    """
    settings = get_settings()
    base = settings.keycloak_internal_url or settings.keycloak_issuer_url
    url = f"{base}/protocol/openid-connect/certs"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10.0)
        resp.raise_for_status()
    keys = {key["kid"]: key for key in resp.json()["keys"]}
    _jwks_cache.store(keys)
    return keys


async def _get_jwks() -> dict[str, dict]:
    """Return JWKS, refreshing if TTL expired or empty."""
    if not _jwks_cache.is_valid:
        return await _fetch_jwks()
    return _jwks_cache.keys


def _verify_token(token: str, jwks: dict[str, dict]) -> dict:
    """Decode + verify a Keycloak JWT. Returns the payload."""
    settings = get_settings()
    header = jwt.get_unverified_header(token)
    kid = header["kid"]

    if kid not in jwks:
        raise jwt.InvalidTokenError("Unknown kid")

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(jwks[kid])
    return jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        audience=settings.keycloak_client_id,
        issuer=settings.keycloak_issuer_url,
    )


# ── Tenant resolution ──────────────────────────────────────────────────


def get_current_tenant(db: Session, user_sub: str) -> UUID:
    """Look up the tenant for ``user_sub`` via ``user_tenants``.

    Raises 403 if the user has no tenant membership.  Does not hardcode
    the tenant id — the lookup is real even though today it resolves to
    one row.
    """
    from app.models.tenant import UserTenant

    tenant_id = db.execute(
        select(UserTenant.tenant_id).where(UserTenant.user_id == user_sub)
    ).scalar_one_or_none()

    if tenant_id is None:
        raise ForbiddenError("No tenant membership — contact an administrator")

    return tenant_id


def maybe_bootstrap_admin(
    db: Session,
    user_sub: str,
    user_email: str | None,
    email_verified: bool,
) -> UUID | None:
    """One-time-by-outcome per tenant: if ``user_roles`` has zero rows for the
    default tenant, ``email_verified`` is true, and ``user_email`` matches that
    tenant's ``admin_email`` (case-insensitive), assign the ``tenant_admin``
    role scoped to that tenant.

    Only the migration-seeded ``default`` tenant relies on this.  Tenants created
    through the platform API get their admin provisioned up front, so their first
    login finds an existing membership and never reaches here.

    Returns the tenant_id on bootstrap, ``None`` otherwise.  Idempotent —
    must never fire again once any role row exists for the tenant.
    """
    from app.models.authorization import Role, UserRole
    from app.models.tenant import Tenant, UserTenant

    tenant = db.execute(
        select(Tenant).where(Tenant.name == "default")
    ).scalar_one_or_none()
    if tenant is None:
        return None

    # Check if bootstrap already fired: any role row for this tenant?
    has_any_roles = db.execute(
        select(UserRole.user_id).where(UserRole.tenant_id == tenant.id).limit(1)
    ).scalar_one_or_none()
    if has_any_roles is not None:
        return None  # Bootstrap already fired — this user wasn't included.

    # Check email match.
    if not email_verified or not user_email:
        return None
    if user_email.lower() != (tenant.admin_email or "").lower():
        return None

    # Find the tenant_admin role.
    tenant_admin_role = db.execute(
        select(Role).where(Role.slug == "tenant_admin")
    ).scalar_one_or_none()
    if tenant_admin_role is None:
        return None

    # Bootstrap: create tenant membership + tenant_admin role assignment.
    db.add(UserTenant(user_id=user_sub, tenant_id=tenant.id))
    db.add(UserRole(user_id=user_sub, role_id=tenant_admin_role.id, tenant_id=tenant.id))
    db.flush()

    logger.info(
        "bootstrap: assigned tenant_admin to %s for tenant %s",
        user_sub,
        tenant.id,
    )
    return tenant.id


def bootstrap_platform_admin(
    db: Session,
    user_sub: str,
    user_email: str | None,
    email_verified: bool,
) -> UUID | None:
    """One-time-by-outcome: if the platform pseudo-tenant has zero role rows
    and the logging-in user's verified email matches ``Settings.platform_admin_email``,
    replace the placeholder bootstrap user with this real Keycloak sub and
    assign the ``platform_admin`` role.

    Unlike ``maybe_bootstrap_admin``, this does NOT block re-entry after the
    first user: additional platform admins are assigned via the platform
    dashboard.  The one-time guard only prevents re-bootstrapping when the
    placeholder row is still the only row.

    Returns the platform tenant_id on success, ``None`` otherwise.
    """
    from app.core.config import get_settings
    from app.models.authorization import Role, UserRole
    from app.models.tenant import Tenant, UserTenant

    settings = get_settings()

    # Email match gate.
    if not email_verified or not user_email:
        return None
    if user_email.lower() != settings.platform_admin_email.lower():
        return None

    platform_tenant = db.execute(
        select(Tenant).where(Tenant.is_platform.is_(True))
    ).scalar_one_or_none()
    if platform_tenant is None:
        return None

    # Already has a real (non-placeholder) membership?  Return it directly.
    real_membership = db.execute(
        select(UserTenant).where(
            UserTenant.tenant_id == platform_tenant.id,
            UserTenant.user_id == user_sub,
        )
    ).scalar_one_or_none()
    if real_membership is not None:
        return platform_tenant.id

    # Replace the placeholder bootstrap user with this real sub.
    BOOTSTRAP_PLACEHOLDER = "platform-admin-bootstrap"
    placeholder_role = db.execute(
        select(UserRole).where(
            UserRole.user_id == BOOTSTRAP_PLACEHOLDER,
            UserRole.tenant_id == platform_tenant.id,
        )
    ).scalar_one_or_none()

    platform_admin_role = db.execute(
        select(Role).where(Role.slug == "platform_admin")
    ).scalar_one_or_none()
    if platform_admin_role is None:
        return None

    if placeholder_role is not None:
        # Migrate placeholder → real sub.
        db.delete(placeholder_role)
        db.execute(
            UserTenant.__table__.delete().where(
                UserTenant.user_id == BOOTSTRAP_PLACEHOLDER,
                UserTenant.tenant_id == platform_tenant.id,
            )
        )
        db.flush()

    db.add(UserTenant(user_id=user_sub, tenant_id=platform_tenant.id))
    db.add(
        UserRole(
            user_id=user_sub,
            role_id=platform_admin_role.id,
            tenant_id=platform_tenant.id,
        )
    )
    db.flush()

    logger.info(
        "bootstrap: assigned platform_admin to %s for platform tenant %s",
        user_sub,
        platform_tenant.id,
    )
    return platform_tenant.id



def resolve_tenant_id(
    db: Session,
    user_sub: str,
    user_email: str | None = None,
    email_verified: bool = False,
) -> UUID:
    """Get the tenant_id for this user, bootstrapping if this is the first user
    in the default tenant or the platform admin is logging in for the first time.
    Raises 403 if no membership can be established."""
    # Try existing membership first.
    try:
        return get_current_tenant(db, user_sub)
    except ForbiddenError:
        pass

    # Try platform admin bootstrap first (email-matched).
    tenant_id = bootstrap_platform_admin(db, user_sub, user_email, email_verified)
    if tenant_id is not None:
        return tenant_id

    # Try default tenant bootstrap.
    tenant_id = maybe_bootstrap_admin(db, user_sub, user_email, email_verified)
    if tenant_id is not None:
        return tenant_id

    raise ForbiddenError("No tenant membership — contact an administrator")


def _resolve_identity(
    db: Session,
    sub: str,
    username: str,
    email: str | None = None,
    email_verified: bool = False,
) -> UUID:
    """Upsert the user and resolve their tenant, committing the result.

    Runs the blocking DB work as one unit so it can be dispatched to a worker
    thread.  The commit is deliberate: identity bootstrap is a side effect that
    must survive even when the route itself goes on to raise 403, otherwise the
    next request repeats the same inserts and contends on the same rows.
    """
    upsert_user(db, sub, email=email, username=username)
    tenant_id = resolve_tenant_id(db, sub, email, email_verified)
    db.commit()
    return tenant_id


# ── User upsert ────────────────────────────────────────────────────────


def upsert_user(
    db: Session,
    sub: str,
    email: str | None,
    username: str | None,
) -> None:
    """Insert or update the ``users`` row for this Keycloak sub.

    Only writes if the user is new or if email/username changed — avoids
    a write on every request.
    """
    from app.models.tenant import User

    existing = db.get(User, sub)
    if existing is not None:
        needs_update = (
            (email is not None and existing.email != email)
            or (username is not None and existing.username != username)
        )
        if needs_update:
            if email is not None:
                existing.email = email
            if username is not None:
                existing.username = username
            db.flush()
        return

    db.add(User(
        id=sub,
        email=email or "",
        username=username,
    ))
    db.flush()


# ── Soft delete ────────────────────────────────────────────────────────


def soft_delete_user(db: Session, user_sub: str) -> None:
    """Soft-delete a user: set ``deleted_at``, remove tenant memberships and
    role assignments.  Does NOT touch Keycloak — caller is responsible for
    disabling the Keycloak account via the Admin API.

    Wrapped in a savepoint so the caller can manage the outer transaction.
    """
    from app.models.authorization import UserRole
    from app.models.tenant import User, UserTenant

    user = db.get(User, user_sub)
    if user is None:
        raise NotFoundError(f"user {user_sub} not found")

    user.deleted_at = datetime.now(timezone.utc)

    # Remove role assignments.
    db.execute(
        UserRole.__table__.delete().where(UserRole.user_id == user_sub)
    )

    # Remove tenant memberships.
    db.execute(
        UserTenant.__table__.delete().where(UserTenant.user_id == user_sub)
    )

    db.flush()


# ── Identity resolution ────────────────────────────────────────────────


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_debug_user: str | None = Header(default=None, include_in_schema=False),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """FastAPI dependency that resolves the caller's identity.

    Resolution order:
      1. ``X-Debug-User`` header — tests and local development.
      2. ``Authorization: Bearer`` header — Swagger UI / BFF proxy.
      3. No credentials → 401.
    """
    # 1. Debug header — tests and local development ONLY.
    settings = get_settings()
    if x_debug_user and settings.environment != "production":
        sub, username, _perms = x_debug_user.split(":", 2)

        # Upsert user and resolve tenant (same path as real JWT).
        tenant_id = await run_in_threadpool(_resolve_identity, db, sub, username)

        return CurrentUser(sub=sub, username=username, tenant_id=tenant_id)

    # 2. Bearer header — Swagger / BFF proxy.
    if credentials:
        token = credentials.credentials
        jwks = await _get_jwks()
        try:
            payload = _verify_token(token, jwks)
        except jwt.InvalidTokenError as exc:
            # Handle unknown kid: refresh JWKS once and retry.
            if "Unknown kid" in str(exc):
                logger.warning(
                    "Unknown kid in JWT, refreshing JWKS cache",
                    extra={"request_id": request.headers.get("x-request-id", "-")},
                )
                jwks = await _fetch_jwks()
                try:
                    payload = _verify_token(token, jwks)
                except jwt.ExpiredSignatureError:
                    raise HTTPException(status_code=401, detail="Token expired")
                except jwt.InvalidTokenError:
                    raise HTTPException(status_code=401, detail="Invalid token")
            elif isinstance(exc, jwt.ExpiredSignatureError):
                raise HTTPException(status_code=401, detail="Token expired")
            else:
                raise HTTPException(status_code=401, detail="Invalid token")

        sub = payload["sub"]
        username = payload.get("preferred_username", "")
        email = payload.get("email")
        email_verified = payload.get("email_verified", False)

        # Upsert user and resolve tenant.  Dispatched to a worker thread: this
        # is a synchronous DB round trip inside an async dependency, and doing
        # it inline blocks the event loop for every other in-flight request.
        tenant_id = await run_in_threadpool(
            _resolve_identity, db, sub, username, email, email_verified
        )

        # JWT is identity-only — roles are intentionally ignored here.
        # Permissions are resolved from the database by require_permission().
        return CurrentUser(
            sub=sub,
            username=username,
            tenant_id=tenant_id,
        )

    # 3. No auth — 401.
    raise HTTPException(status_code=401, detail="Not authenticated")


def require_permission(permission: str):
    """Router dependency: 403 unless the caller has the specified permission.

    Resolves permissions from the database via the permission service.
    Deny-by-default: if the permission is not in the resolved set, access is denied.

    Logs every decision (allow/deny) with user_id, permission, decision, and
    request_id for structured observability.
    """

    async def checker(
        request: Request,
        user: CurrentUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> CurrentUser:
        from app.services.permission_service import resolve_permissions

        user.permissions = resolve_permissions(db, user.sub, user.tenant_id)
        granted = permission in user.permissions

        logger.info(
            "permission check",
            extra={
                "request_id": get_request_id(),
                "user_id": user.sub,
                "tenant_id": str(user.tenant_id),
                "permission": permission,
                "decision": "allow" if granted else "deny",
                "status": 200 if granted else 403,
            },
        )

        if not granted:
            raise ForbiddenError(
                f"requires permission '{permission}', "
                f"caller has {sorted(user.permissions) or '(none)'}"
            )
        return user

    return checker


# ── Tenant scope ───────────────────────────────────────────────────────


def enforce_tenant_scope(
    resource_tenant_id: UUID,
    current_tenant_id: UUID,
) -> None:
    """Hard boundary: raise 403 if the resource belongs to a different tenant.

    No permission can bypass this — not even ``warehouse.global``, which means
    "all warehouses within my tenant," never across tenants.
    """
    if resource_tenant_id != current_tenant_id:
        raise ForbiddenError("cross-tenant access denied")


# ── Warehouse scope ────────────────────────────────────────────────────

def assigned_warehouse_ids(db: Session, user: CurrentUser) -> set[UUID]:
    """Return warehouse IDs assigned to this user within their current tenant."""
    rows = db.execute(
        select(UserWarehouseAssignment.warehouse_id)
        .join(Warehouse, Warehouse.id == UserWarehouseAssignment.warehouse_id)
        .where(
            UserWarehouseAssignment.user_id == user.sub,
            Warehouse.tenant_id == user.tenant_id,
        )
    ).scalars()
    return set(rows)


def _ensure_permissions(db: Session, user: CurrentUser) -> None:
    """Lazily resolve permissions from the DB if not already populated."""
    if not user.permissions:
        from app.services.permission_service import resolve_permissions
        user.permissions = resolve_permissions(db, user.sub, user.tenant_id)


def enforce_warehouse_scope(db: Session, user: CurrentUser, warehouse_id: UUID | None) -> None:
    """The warehouse-scope check (Sections 9, 13.3). Called by every service entry
    point and agent tool that touches a specific warehouse — built in from Phase 1,
    not bolted on. Users with ``warehouse.global`` permission bypass scoping
    (within their tenant only)."""
    _ensure_permissions(db, user)
    if _GLOBAL_PERMISSIONS & user.permissions:
        return
    if warehouse_id is None:
        raise ForbiddenError("warehouse-scoped role must specify a warehouse_id")
    if warehouse_id not in assigned_warehouse_ids(db, user):
        raise ForbiddenError(f"not assigned to warehouse {warehouse_id}")


def enforce_any_warehouse_scope(
    db: Session, user: CurrentUser, warehouse_ids: Iterable[UUID | None]
) -> None:
    """Like enforce_warehouse_scope, but passes if the caller is assigned to
    ANY of the given warehouses.

    For read access to a resource that spans two warehouses — an internal
    transfer's source and destination — either side's Warehouse Manager
    should be able to see it (developer-guide.md §13.11, journeys.md
    Journey 3). Write actions (pick-lists, ship, deliver) stay source-only
    via the plain enforce_warehouse_scope; this is read-visibility only.
    """
    _ensure_permissions(db, user)
    if _GLOBAL_PERMISSIONS & user.permissions:
        return
    ids = {w for w in warehouse_ids if w is not None}
    if not ids:
        raise ForbiddenError("warehouse-scoped role must specify a warehouse_id")
    if not ids & assigned_warehouse_ids(db, user):
        raise ForbiddenError(f"not assigned to any of {sorted(ids)}")


def scope_filter_warehouse_ids(db: Session, user: CurrentUser) -> set[UUID]:
    """For list endpoints: the set of warehouse ids the caller may see.

    Always concrete and always tenant-scoped, even for ``warehouse.global``
    holders — "global" means "every warehouse in my tenant," never across
    tenants (mirrors enforce_tenant_scope's guarantee). Returning `None` here
    previously let callers skip filtering entirely, which leaked
    cross-tenant rows wherever the resource table carries no tenant_id of its
    own (warehouse_stock, purchase_orders, outbound_requests, ...).
    """
    _ensure_permissions(db, user)
    if _GLOBAL_PERMISSIONS & user.permissions:
        rows = db.execute(
            select(Warehouse.id).where(Warehouse.tenant_id == user.tenant_id)
        ).scalars()
        return set(rows)
    return assigned_warehouse_ids(db, user)
