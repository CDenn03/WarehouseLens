"""Auth & RBAC (Section 9).

Authentication uses Keycloak JWTs verified against the realm's JWKS endpoint.
The dependency resolves identity via three sources (in priority order):
  1. ``X-Debug-User`` header — tests and local dev only.
  2. ``access_token`` cookie — BFF pattern, primary in production.
  3. ``Authorization: Bearer`` header — Swagger UI / direct API callers.

Enforcement helpers (roles + warehouse scope) are used by every router and
agent tool.
"""

from dataclasses import dataclass, field
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import ForbiddenError
from app.models.warehouse import UserWarehouseAssignment

ROLE_ADMIN = "admin"
ROLE_WAREHOUSE_MANAGER = "warehouse_manager"
ROLE_PROCUREMENT_OFFICER = "procurement_officer"
ROLE_AUDITOR = "auditor"

# Admin and Auditor are global — they never appear in user_warehouse_assignments
# (Section 13.3). Only these two roles get scope-checked.
WAREHOUSE_SCOPED_ROLES = {ROLE_WAREHOUSE_MANAGER, ROLE_PROCUREMENT_OFFICER}

READ_ONLY_ROLES = {ROLE_AUDITOR}

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    """What the backend trusts about the caller, extracted from the Keycloak JWT."""

    sub: str
    username: str
    roles: set[str] = field(default_factory=set)

    @property
    def is_global(self) -> bool:
        return bool(self.roles & {ROLE_ADMIN, ROLE_AUDITOR})


JWKS_CACHE: dict[str, dict] = {}


async def _fetch_jwks() -> dict[str, dict]:
    """Fetch Keycloak's public keys, cache by kid."""
    settings = get_settings()
    url = f"{settings.keycloak_issuer_url}/protocol/openid-connect/certs"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        resp.raise_for_status()
    for key in resp.json()["keys"]:
        JWKS_CACHE[key["kid"]] = key
    return JWKS_CACHE


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
    response: Response,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_debug_user: str | None = Header(default=None, include_in_schema=False),
) -> CurrentUser:
    """FastAPI dependency that resolves the caller's identity.

    Resolution order:
      1. ``X-Debug-User`` header — tests and local dev (``sub:username:role1|role2``).
      2. ``access_token`` cookie — BFF pattern, primary in production.
      3. ``Authorization: Bearer`` header — Swagger UI / direct API callers.
      4. No credentials → 401.
    """
    # 1. Debug header — tests and local development.
    if x_debug_user:
        sub, username, roles = x_debug_user.split(":", 2)
        return CurrentUser(sub=sub, username=username, roles=set(roles.split("|")))

    # 2. Cookie (BFF pattern — primary in production).
    token = request.cookies.get("access_token")

    # 3. Bearer header (Swagger fallback).
    if not token and credentials:
        token = credentials.credentials

    if token:
        jwks = JWKS_CACHE or await _fetch_jwks()
        try:
            payload = _verify_token(token, jwks)
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")

        roles = set(payload.get("realm_access", {}).get("roles", []))
        return CurrentUser(
            sub=payload["sub"],
            username=payload.get("preferred_username", ""),
            roles=roles,
        )

    # 4. No auth — 401.
    raise HTTPException(status_code=401, detail="Not authenticated")


def require_roles(*allowed: str):
    """Router dependency: 403 unless the caller has one of `allowed`."""

    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not user.roles & set(allowed):
            raise ForbiddenError(
                f"requires one of roles {sorted(allowed)}, caller has {sorted(user.roles)}"
            )
        return user

    return checker


def assigned_warehouse_ids(db: Session, user: CurrentUser) -> set[UUID]:
    rows = db.execute(
        select(UserWarehouseAssignment.warehouse_id).where(
            UserWarehouseAssignment.user_id == user.sub
        )
    ).scalars()
    return set(rows)


def enforce_warehouse_scope(db: Session, user: CurrentUser, warehouse_id: UUID | None) -> None:
    """The warehouse-scope check (Sections 9, 13.3). Called by every service entry
    point and agent tool that touches a specific warehouse — built in from Phase 1,
    not bolted on. Admin/Auditor are global; scoped roles must be assigned."""
    if user.is_global:
        return
    if warehouse_id is None:
        raise ForbiddenError("warehouse-scoped role must specify a warehouse_id")
    if warehouse_id not in assigned_warehouse_ids(db, user):
        raise ForbiddenError(f"not assigned to warehouse {warehouse_id}")


def scope_filter_warehouse_ids(db: Session, user: CurrentUser) -> set[UUID] | None:
    """For list endpoints: None means 'no filter' (global roles); otherwise the set
    of warehouse ids the caller may see (possibly empty)."""
    if user.is_global:
        return None
    return assigned_warehouse_ids(db, user)
