"""Auth router — lightweight identity endpoint for the frontend shell.

Endpoints:
  GET /auth/me — return the current user's identity and roles in their
                 resolved tenant.  Requires only authentication (no
                 permission gate) so the layout can determine sidebar
                 navigation without needing iam.user.read.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.authorization import Role, UserRole
from app.schemas.auth import MeResponse, RoleSummary

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=MeResponse)
def get_me(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's identity and tenant-scoped roles."""
    roles = []
    if user.tenant_id is not None:
        role_rows = db.execute(
            select(Role)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user.sub,
                UserRole.tenant_id == user.tenant_id,
            )
        ).scalars().all()
        roles = [RoleSummary(slug=r.slug, name=r.name) for r in role_rows]

    return MeResponse(
        sub=user.sub,
        username=user.username,
        email=None,
        tenant_id=user.tenant_id,
        roles=roles,
    )
