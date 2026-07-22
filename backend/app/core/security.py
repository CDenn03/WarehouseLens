"""Auth & RBAC (Section 9).

LEARNING AREA — Keycloak. The JWT validation below is a SCAFFOLD: the dependency
returns a hardcoded fake payload so the rest of the app can be built and tested.
The *enforcement* helpers further down (roles + warehouse scope) are real and are
exercised by every router and agent tool — they just currently receive fake claims.
"""

from dataclasses import dataclass, field
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

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


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_debug_user: str | None = Header(default=None, include_in_schema=False),
) -> CurrentUser:
    """FastAPI dependency that resolves the caller's identity.

    The Bearer security scheme (``bearer_scheme``) is what drives the
    Swagger UI **Authorize** padlock button and the global
    ``securitySchemes.HTTPBearer`` entry in the OpenAPI document.

    Debug header
    ~~~~~~~~~~~~
    ``X-Debug-User`` ("sub:username:role1|role2") lets tests and the seed
    script impersonate scoped users so RBAC logic is testable before
    Keycloak exists.  It is hidden from the OpenAPI schema via
    ``include_in_schema=False``.

    Keycloak integration (TODO)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Real implementation outline:
      1. Fetch Keycloak's JWKS from
         {KEYCLOAK_ISSUER_URL}/protocol/openid-connect/certs and CACHE it.
      2. Verify signature (RS256), ``iss``, ``exp``, and audience.
      3. Extract realm roles from ``realm_access.roles`` (or client roles
         from ``resource_access.<client>.roles``).
      4. Return CurrentUser(sub, preferred_username, roles).

    Until then: ``X-Debug-User`` or a hardcoded admin fallback.
    """
    # 1. Debug header — for tests and local development.
    if x_debug_user:
        sub, username, roles = x_debug_user.split(":", 2)
        return CurrentUser(sub=sub, username=username, roles=set(roles.split("|")))

    # 2. JWT path — currently a scaffold, will validate against Keycloak.
    # TODO: raise HTTPException(status_code=401) once Keycloak is live
    #       and remove the hardcoded fallback.
    return CurrentUser(sub="fake-sub-admin", username="dev-admin", roles={ROLE_ADMIN})


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
