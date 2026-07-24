"""Auth & RBAC — migrated to permission-based authorization.

Authentication uses Keycloak JWTs verified against the realm's JWKS endpoint.
The dependency resolves identity via two sources (in priority order):
  1. ``X-Debug-User`` header — tests and local dev only (gated by environment).
  2. ``Authorization: Bearer`` header — Swagger UI / BFF proxy.

Authorization is permission-based: ``require_permission()`` resolves the
caller's permissions from the database and enforces deny-by-default.

JWKS cache has a 15-minute TTL and handles key rotation automatically.
"""

import logging
import time
from dataclasses import dataclass, field
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.correlation import get_request_id
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import ForbiddenError
from app.models.warehouse import UserWarehouseAssignment

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

# Permissions that grant global (all-warehouse) scope.
_GLOBAL_PERMISSIONS = {"warehouse.global"}

# JWKS cache TTL in seconds (15 minutes).
_JWKS_TTL_SECONDS = 15 * 60


@dataclass
class CurrentUser:
    """What the backend trusts about the caller, extracted from the Keycloak JWT.

    Fields:
      sub:      stable Keycloak subject identifier
      username: human-readable preferred_username
      permissions: resolved from the DB by require_permission() — never from JWT
    """

    sub: str
    username: str
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
    """Fetch Keycloak's public keys, cache by kid."""
    settings = get_settings()
    url = f"{settings.keycloak_issuer_url}/protocol/openid-connect/certs"
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


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_debug_user: str | None = Header(default=None, include_in_schema=False),
) -> CurrentUser:
    """FastAPI dependency that resolves the caller's identity.

    Resolution order:
      1. ``X-Debug-User`` header — tests and local dev.
      2. ``Authorization: Bearer`` header — Swagger UI / BFF proxy.
      3. No credentials → 401.
    """
    # 1. Debug header — tests and local development ONLY.
    #    Gated behind environment check so a misconfigured production deployment
    #    cannot silently enable full auth bypass via this header.
    settings = get_settings()
    if x_debug_user and settings.environment != "production":
        sub, username, _perms = x_debug_user.split(":", 2)
        return CurrentUser(sub=sub, username=username)

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

        # JWT is identity-only — roles are intentionally ignored here.
        # Permissions are resolved from the database by require_permission().
        return CurrentUser(
            sub=payload["sub"],
            username=payload.get("preferred_username", ""),
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

        user.permissions = resolve_permissions(db, user.sub)
        granted = permission in user.permissions

        logger.info(
            "permission check",
            extra={
                "request_id": get_request_id(),
                "user_id": user.sub,
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


# ── Warehouse scope ────────────────────────────────────────────────────

def assigned_warehouse_ids(db: Session, user: CurrentUser) -> set[UUID]:
    rows = db.execute(
        select(UserWarehouseAssignment.warehouse_id).where(
            UserWarehouseAssignment.user_id == user.sub
        )
    ).scalars()
    return set(rows)


def _ensure_permissions(db: Session, user: CurrentUser) -> None:
    """Lazily resolve permissions from the DB if not already populated."""
    if not user.permissions:
        from app.services.permission_service import resolve_permissions
        user.permissions = resolve_permissions(db, user.sub)


def enforce_warehouse_scope(db: Session, user: CurrentUser, warehouse_id: UUID | None) -> None:
    """The warehouse-scope check (Sections 9, 13.3). Called by every service entry
    point and agent tool that touches a specific warehouse — built in from Phase 1,
    not bolted on. Users with ``warehouse.global`` permission bypass scoping."""
    _ensure_permissions(db, user)
    if _GLOBAL_PERMISSIONS & user.permissions:
        return
    if warehouse_id is None:
        raise ForbiddenError("warehouse-scoped role must specify a warehouse_id")
    if warehouse_id not in assigned_warehouse_ids(db, user):
        raise ForbiddenError(f"not assigned to warehouse {warehouse_id}")


def scope_filter_warehouse_ids(db: Session, user: CurrentUser) -> set[UUID] | None:
    """For list endpoints: None means 'no filter' (global); otherwise the set
    of warehouse ids the caller may see (possibly empty)."""
    _ensure_permissions(db, user)
    if _GLOBAL_PERMISSIONS & user.permissions:
        return None
    return assigned_warehouse_ids(db, user)
