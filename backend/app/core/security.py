"""Auth & RBAC (Section 9).

LEARNING AREA — Keycloak. The JWT validation below is a SCAFFOLD: the dependency
returns a hardcoded fake payload so the rest of the app can be built and tested.
The *enforcement* helpers further down (roles + warehouse scope) are real and are
exercised by every router and agent tool — they just currently receive fake claims.
"""

from dataclasses import dataclass, field
from uuid import UUID

from fastapi import Depends, Header
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
    authorization: str | None = Header(default=None),
    x_debug_user: str | None = Header(default=None),
) -> CurrentUser:
    """FastAPI dependency that will validate the Keycloak-issued JWT.

    TODO(learning): Real implementation outline — this is the core of the Keycloak
    integration and worth doing by hand before reaching for a library:
      1. Require `Authorization: Bearer <token>`; 401 if missing/malformed.
      2. Fetch Keycloak's JWKS from
         {KEYCLOAK_ISSUER_URL}/protocol/openid-connect/certs and CACHE it (the keys
         rotate rarely; refetch on unknown `kid`). This is where Redis could hold the
         JWKS cache, but an in-process dict is fine for one backend instance.
      3. Verify signature (RS256), `iss` == KEYCLOAK_ISSUER_URL, `exp`, and audience.
         Decision to make: Keycloak puts the client in `azp` and often sets
         `aud=account` by default — you either add an audience mapper to the client in
         the realm config, or validate `azp` instead of `aud`. The mapper is the
         "correct" OIDC answer; `azp` is the pragmatic one. Try both, understand why.
      4. Extract roles. Decision to make: realm roles live at
         `realm_access.roles`; client roles at `resource_access.<client>.roles`.
         Realm roles are simpler for 4 global role names; client roles keep the realm
         reusable across apps. Pick one and normalize to the ROLE_* constants above.
      5. Return CurrentUser(sub=claims["sub"], username=claims["preferred_username"], roles=...).

    TODO(learning): Realm setup this depends on (do it in the Keycloak admin console,
    export the realm JSON into the repo afterwards so it's reproducible):
      - realm `warehouselens`; client `warehouselens-backend` (bearer-only / no login UI)
        and `warehouselens-frontend` (public client, Authorization Code + PKCE — the
        frontend does the login redirect, the backend only ever *verifies* tokens);
      - the four realm roles; a few test users with role mappings.

    Until then: a hardcoded admin. The optional `X-Debug-User` header
    ("sub:username:role1|role2") lets tests and the seed script impersonate scoped
    users so RBAC logic is testable before Keycloak exists.
    """
    if x_debug_user:
        sub, username, roles = x_debug_user.split(":", 2)
        return CurrentUser(sub=sub, username=username, roles=set(roles.split("|")))
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
