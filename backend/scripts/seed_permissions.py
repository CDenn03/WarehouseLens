"""Idempotent seed script: upserts permissions, roles, and role→permission
mappings from the code-level constants into the database.

Usage:
    # From the backend directory:
    python -m scripts.seed_permissions

    # Or with explicit DATABASE_URL override:
    DATABASE_URL=sqlite:///./local.db python -m scripts.seed_permissions

Requires: DATABASE_URL in environment (defaults to the backend's own setting).
"""

import os
import sys

# Ensure the backend package root is on the path.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("DATABASE_URL", "sqlite:///./local.db")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.permissions import ALL_PERMISSIONS, PERMISSION_CATEGORY
from app.core.permissions.roles import ROLE_DEFINITIONS, ROLE_NAMES
from app.models.authorization import Permission, Role, RolePermission


def upsert_permissions(session: Session) -> int:
    """Upsert all permissions from the code catalog. Returns count."""
    count = 0
    for pid, desc in ALL_PERMISSIONS.items():
        existing = session.get(Permission, pid)
        if existing:
            existing.description = desc
            existing.category = PERMISSION_CATEGORY[pid]
        else:
            session.add(Permission(
                id=pid,
                description=desc,
                category=PERMISSION_CATEGORY[pid],
            ))
        count += 1
    session.flush()
    return count


def upsert_roles(session: Session) -> int:
    """Upsert roles from ROLE_DEFINITIONS. Returns count."""
    count = 0
    for slug in ROLE_DEFINITIONS:
        existing = session.query(Role).filter(Role.slug == slug).first()
        if not existing:
            session.add(Role(slug=slug, name=ROLE_NAMES[slug]))
        count += 1
    session.flush()
    return count


def upsert_role_permissions(session: Session) -> int:
    """Delete existing role→permission mappings and re-insert from
    ROLE_DEFINITIONS (authoritative source). Returns count."""
    count = 0
    for slug, perms in ROLE_DEFINITIONS.items():
        role = session.query(Role).filter(Role.slug == slug).first()
        if not role:
            # This shouldn't happen after upsert_roles, but be safe.
            continue
        # Clear existing mappings.
        session.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
        # Insert fresh mappings.
        for pid in perms:
            session.add(RolePermission(role_id=role.id, permission_id=pid))
            count += 1
    session.flush()
    return count


def main():
    url = os.environ.get("DATABASE_URL", "sqlite:///./local.db")
    engine = create_engine(url)
    SessionLocal = sessionmaker(bind=engine)

    session = SessionLocal()
    try:
        n_perms = upsert_permissions(session)
        n_roles = upsert_roles(session)
        n_mappings = upsert_role_permissions(session)
        session.commit()
        print(f"Seeded {n_perms} permissions, {n_roles} roles, {n_mappings} role→permission mappings.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
