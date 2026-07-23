"""Permission resolution — reads roles and permissions from PostgreSQL.

Resolution algorithm (deny-by-default):
  1. Look up user_roles for the given user_id.
  2. Look up role_permissions for each assigned role.
  3. Return a deduplicated set of permission IDs.

No caching per the architecture doc: add caching only after performance
measurements show a bottleneck.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.authorization import RolePermission, UserRole


def resolve_permissions(db: Session, user_id: str) -> set[str]:
    """Return the set of permission IDs granted to ``user_id`` via their roles.

    >>> resolve_permissions(db, "some-keycloak-sub")
    {'inventory.read', 'dashboard.read', ...}
    """
    # 1. Find role IDs assigned to this user.
    role_ids = db.execute(
        select(UserRole.role_id).where(UserRole.user_id == user_id)
    ).scalars().all()

    if not role_ids:
        return set()

    # 2. Find all permissions granted to those roles.
    permission_ids = db.execute(
        select(RolePermission.permission_id).where(
            RolePermission.role_id.in_(role_ids)
        )
    ).scalars().all()

    return set(permission_ids)


def log_access_decision(
    db: Session,
    *,
    user_id: str,
    permission_id: str,
    decision: str,
    source: str | None = None,
    action_context: str | None = None,
) -> None:
    """Write a row to access_decisions for state-changing financial actions.

    Call this only for sensitive operations (approve disbursement, reverse
    transaction, export regulatory report, etc.), not for every read.
    """
    from app.models.authorization import AccessDecision

    db.add(AccessDecision(
        user_id=user_id,
        permission_id=permission_id,
        decision=decision,
        source=source,
        action_context=action_context,
    ))
    db.flush()
