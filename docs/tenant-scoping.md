# WarehouseLens — Tenant Scoping & Multi-Tenancy

This document covers the tenant-ready architecture added in migration 0004: schema design, resolution logic, scope enforcement, bootstrap flow, and the boundary between single-tenant today and multi-tenant later.

---

## Architecture at a Glance

```
Browser                Next.js BFF              FastAPI                   PostgreSQL
  │                        │                       │                          │
  │  1. Login via Keycloak │                       │                          │
  │◄──────────────────────►│                       │                          │
  │                        │                       │                          │
  │  2. Session cookie     │                       │                          │
  ├───────────────────────►│                       │                          │
  │                        │                       │                          │
  │  3. GET /api/v1/...    │                       │                          │
  ├───────────────────────►│                       │                          │
  │                        │  4. Bearer + X-Req-ID │                          │
  │                        ├──────────────────────►│                          │
  │                        │                       │                          │
  │                        │                       │  5. Verify JWT (JWKS)    │
  │                        │                       │                          │
  │                        │                       │  6. Upsert users row     │
  │                        │                       │     (upsert_user)        │
  │                        │                       ├─────────────────────────►│
  │                        │                       │                          │
  │                        │                       │  7. Resolve tenant_id    │
  │                        │                       │     (user_tenants)       │
  │                        │                       ├─────────────────────────►│
  │                        │                       │                          │
  │                        │                       │  8. Bootstrap admin?     │
  │                        │                       │     (one-shot, gated)    │
  │                        │                       │                          │
  │                        │                       │  9. Resolve permissions  │
  │                        │                       │     scoped to tenant     │
  │                        │                       ├─────────────────────────►│
  │                        │                       │                          │
  │                        │                       │ 10. enforce_tenant_scope │
  │                        │                       │     (hard boundary)      │
  │                        │                       │                          │
  │                        │  11. Response          │                          │
  │                        │◄──────────────────────┤                          │
  │  12. Response          │                       │                          │
  │◄───────────────────────┤                       │                          │
```

Every request now resolves `tenant_id` **before** any permission check or data access. This is a hard boundary — no permission can bypass it.

---

## Schema Design

### New Tables (migration 0004)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│   tenants    │       │   user_tenants    │       │    users     │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │◄──────│ tenant_id (FK)   │       │ id (PK)      │  ← Keycloak `sub`
│ name         │       │ user_id (FK)     │──────►│ email        │
│ superuser_   │       └──────────────────┘       │ username     │
│   email      │                                  │ created_at   │
│ created_at   │                                  │ deleted_at   │
└──────────────┘                                  └──────────────┘
```

### Modified Tables

```
┌─────────────────────┐        ┌─────────────────────┐
│     user_roles       │        │     warehouses       │
├─────────────────────┤        ├─────────────────────┤
│ user_id (PK)        │        │ id (PK)              │
│ role_id (PK)        │        │ name                 │
│ tenant_id (PK, FK)  │  ←NEW │ address              │
│ assigned_at         │        │ tenant_id (PK, FK)   │  ←NEW
│ assigned_by         │        └─────────────────────┘
└─────────────────────┘
```

The `tenant_id` column was added to `user_roles` and `warehouses` via ALTER TABLE + backfill. The composite PK on `user_roles` was reconstructed: `(user_id, role_id)` → `(user_id, role_id, tenant_id)`.

### `created_by` Column

Added to 7 state-changing tables for audit traceability:

| Table | FK target |
|-------|-----------|
| `inventory_transactions` | `users.id` |
| `access_decisions` | `users.id` |
| `purchase_orders` | `users.id` |
| `sales_orders` | `users.id` |
| `outbound_requests` | `users.id` |
| `pick_lists` | `users.id` |
| `shipments` | `users.id` |

All nullable — existing rows get `NULL`.

---

## New IAM Permissions & Roles

Two new permissions added to the permission catalog:

| Permission | Category | Description |
|-----------|----------|-------------|
| `iam.role.manage` | iam | Create/edit roles, assign permissions to roles |
| `iam.user_role.assign` | iam | Assign/revoke roles for a user within a tenant |

One new role:

| Role | Permissions |
|------|-------------|
| **iam_admin** | `iam.role.manage`, `iam.user_role.assign` |

The `iam_admin` role is assigned to the first superuser via the bootstrap flow (see below).

---

## Tenant Resolution

Every request follows this resolution chain in `security.py`:

```
get_current_user()
  │
  ├── Extract identity (sub, username, email)
  │
  ├── upsert_user(db, sub, email, username)
  │   → Insert or update the `users` row (avoids writes if unchanged)
  │
  └── resolve_tenant_id(db, sub, email, email_verified)
        │
        ├── get_current_tenant(db, sub)
        │   → SELECT tenant_id FROM user_tenants WHERE user_id = :sub
        │   → If found: return tenant_id
        │   → If not found: fall through to bootstrap
        │
        └── maybe_bootstrap_admin(db, sub, email, email_verified)
            → One-shot bootstrap (see below)
```

### `get_current_tenant()` — `security.py:148`

Queries `user_tenants` for the user's tenant membership. Raises `403` if no row exists.

```sql
SELECT tenant_id FROM user_tenants WHERE user_id = :sub
```

### `maybe_bootstrap_admin()` — `security.py:155`

One-shot-per-tenant bootstrap for the first superuser. Gates on **three conditions**:

1. `user_roles` has **zero rows** for the default tenant (bootstrap hasn't fired yet)
2. The user's `email_verified` claim is `true`
3. The user's email matches `tenants.admin_email` (case-insensitive)

If all conditions pass, the function:
- Creates a `user_tenants` row (tenant membership)
- Creates a `user_roles` row with the `iam_admin` role

```python
db.add(UserTenant(user_id=user_sub, tenant_id=tenant.id))
db.add(UserRole(user_id=user_sub, role_id=iam_admin_role.id, tenant_id=tenant.id))
```

**Idempotent**: once any role row exists for the tenant, bootstrap never fires again. The first user to log in with a matching email becomes the IAM admin. Subsequent users must be granted roles by that admin.

---

## Scope Enforcement

### Tenant Scope — Hard Boundary

`enforce_tenant_scope()` is a pure comparison with no permission override:

```python
def enforce_tenant_scope(resource_tenant_id: UUID, current_tenant_id: UUID) -> None:
    if resource_tenant_id != current_tenant_id:
        raise ForbiddenError("cross-tenant access denied")
```

This is called on **every mutation endpoint** before the operation executes. The pattern:

```python
@router.post("/purchase-orders")
def create_purchase_order(
    data: PurchaseOrderCreate,
    user: CurrentUser = Depends(require_permission("procurement.order.create")),
):
    wh = get_warehouse(db, data.destination_warehouse_id)
    enforce_tenant_scope(wh.tenant_id, user.tenant_id)  # ← hard boundary
    enforce_warehouse_scope(db, user, data.warehouse_id) # ← warehouse scope
    ...
```

The tenant check always runs **first**, before warehouse scope. No permission — not even `warehouse.global` — can bypass it.

### Warehouse Scope — Tenant-Filtered

`assigned_warehouse_ids()` now filters by tenant:

```sql
SELECT warehouse_id FROM user_warehouse_assignments
JOIN warehouses ON warehouses.id = user_warehouse_assignments.warehouse_id
WHERE user_id = :user_id AND warehouses.tenant_id = :tenant_id
```

`warehouse.global` means "all warehouses **within my tenant**" — never across tenants.

### Endpoints with Tenant Enforcement

| Endpoint | Enforcement |
|----------|-------------|
| `POST /warehouses` | `tenant_id` set from `user.tenant_id` on create |
| `POST /warehouses/{id}/assignments` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `POST /inventory/transactions` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `POST /purchase-orders` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `POST /purchase-orders/{id}/receive` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `POST /sales-orders` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `POST /outbound-requests` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `POST /outbound-requests/{id}/pick-lists` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `PATCH /pick-lists/{id}/items/{id}` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `POST /pick-lists/{id}/complete` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `POST /outbound-requests/{id}/ship` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `PATCH /shipments/{id}/deliver` | `enforce_tenant_scope(wh.tenant_id, user.tenant_id)` |
| `POST /agent/query` | `enforce_warehouse_scope` → implicit tenant filter |
| `GET /dashboard/*` | `scope_filter_warehouse_ids` → implicit tenant filter |
| `GET /products` | implicit via `scope_filter_warehouse_ids` |
| `GET /forecast/{id}` | implicit via `enforce_warehouse_scope` |

---

## `CurrentUser` Object

Updated to carry the resolved tenant context:

```python
@dataclass
class CurrentUser:
    sub: str            # Keycloak UUID — stable, never changes
    username: str       # preferred_username — human-readable
    tenant_id: UUID | None = None  # ← NEW: resolved from user_tenants
    permissions: set[str] = field(default_factory=set)  # resolved from DB, scoped to tenant
```

- `tenant_id` is set during `get_current_user()` after tenant resolution
- `permissions` are resolved via `resolve_permissions(db, user.sub, user.tenant_id)` — the tenant_id filters `user_roles` to only return roles within the current tenant
- `tenant_id` is **never** read from the JWT — it's always resolved from the database

---

## `resolve_permissions()` — Tenant-Scoped

Updated to accept `tenant_id`:

```python
def resolve_permissions(db: Session, user_id: str, tenant_id: UUID) -> set[str]:
    # Step 1: roles for this user within this tenant
    role_ids = db.execute(
        select(UserRole.role_id).where(
            UserRole.user_id == user_id,
            UserRole.tenant_id == tenant_id,
        )
    ).scalars().all()

    # Step 2: permissions for those roles
    permission_ids = db.execute(
        select(RolePermission.permission_id).where(
            RolePermission.role_id.in_(role_ids)
        )
    ).scalars().all()

    return set(permission_ids)
```

A user can have different roles in different tenants. The `tenant_id` filter ensures only the current tenant's roles are resolved.

---

## Soft Delete

`soft_delete_user()` in `security.py`:

```python
def soft_delete_user(db: Session, user_sub: str) -> None:
    user = db.get(User, user_sub)
    user.deleted_at = datetime.now(timezone.utc)

    # Remove all role assignments
    db.execute(UserRole.__table__.delete().where(UserRole.user_id == user_sub))

    # Remove all tenant memberships
    db.execute(UserTenant.__table__.delete().where(UserTenant.user_id == user_sub))
```

- Sets `deleted_at` on the `users` row (user can't authenticate via Keycloak if disabled there too)
- Deletes all `user_roles` rows (immediate permission revocation)
- Does **not** delete `created_by` references — historical audit rows still resolve
- Does **NOT** touch Keycloak — the caller must disable the Keycloak account via the Admin API

---

## Migration 0004 — What It Does

**Forward migration** (applied via `alembic upgrade head`):

1. Creates `tenants`, `users`, `user_tenants` tables
2. Seeds a default tenant with `name='default'` and `admin_email` from `DEFAULT_TENANT_SUPERUSER_EMAIL` env var (defaults to `admin@warehouselens.local`)
3. Adds `tenant_id` to `user_roles` (nullable first → backfill → NOT NULL), reconstructs composite PK
4. Adds `tenant_id` to `warehouses` (nullable first → backfill → NOT NULL)
5. Adds `created_by` to 7 state-changing tables
6. Seeds `iam.role.manage` and `iam.user_role.assign` permissions
7. Seeds the `iam_admin` role with both IAM permissions
8. Creates indexes on `tenant_id` columns and `users.email`

**Downgrade** reverses everything: drops columns, restores PKs, drops new tables.

---

## Single-Tenant vs Multi-Tenant

### Single-Tenant Today

- One tenant row (`name='default'`)
- All users, warehouses, and roles scoped to that tenant
- `enforce_tenant_scope()` always passes (everything is in the same tenant)
- No functional difference from before — the checks are a no-op when there's one tenant

### Multi-Tenant Later

In practice, use the platform API — `POST /api/v1/platform/tenants` does steps 1–4 in one request and provisions the tenant admin's Keycloak account (see [platform-admin.md](platform-admin.md)). The SQL below is the manual equivalent, useful for seeding and recovery.

1. Insert a new row into `tenants`:
   ```sql
   INSERT INTO tenants (id, name, admin_email) VALUES (gen_random_uuid(), 'acme', 'admin@acme.com');
   ```

2. Create warehouses scoped to that tenant:
   ```sql
   INSERT INTO warehouses (id, name, tenant_id) VALUES (gen_random_uuid(), 'Acme Warehouse', :new_tenant_id);
   ```

3. Assign users to that tenant:
   ```sql
   INSERT INTO user_tenants (user_id, tenant_id) VALUES (:user_sub, :new_tenant_id);
   ```

4. Grant roles within that tenant:
   ```sql
   INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES (:user_sub, :role_id, :new_tenant_id);
   ```

5. Assign warehouses to users in that tenant:
   ```sql
   INSERT INTO user_warehouse_assignments (user_id, warehouse_id) VALUES (:user_sub, :wh_id);
   ```

No code changes required. The schema and enforcement logic handle it automatically.

---

## Bootstrap Flow — Detailed Walkthrough

The bootstrap is a one-shot operation that fires on the **first login** of a user whose email matches the tenant's `admin_email`. It now only matters for the migration-seeded `default` tenant: tenants created through the platform API have their admin provisioned up front, so that user already has a membership and never reaches this path.

```
First superuser logs in
  │
  ├── get_current_tenant() → no user_tenants row → 403 (or fall through)
  │
  ├── maybe_bootstrap_admin()
  │   │
  │   ├── Find default tenant → "default"
  │   │
  │   ├── Any role rows for this tenant? → NO (first user)
  │   │
  │   ├── email_verified? → YES
  │   │
  │   ├── email == admin_email? → YES
  │   │
  │   ├── Find iam_admin role → exists (seeded by migration 0004)
  │   │
  │   ├── Create user_tenants row (tenant membership)
  │   │
  │   ├── Create user_roles row (iam_admin role)
  │   │
  │   └── Return tenant_id
  │
  └── Request proceeds with tenant_id + iam_admin permissions
```

**After bootstrap fires**: `user_roles` has at least one row for the tenant, so `maybe_bootstrap_admin()` short-circuits on the first check. The admin must then use the IAM endpoints to create roles and assign users.

---

## Pitfalls to Avoid

### 1. Never Bypass `enforce_tenant_scope()`

```python
# WRONG — skips tenant check
enforce_warehouse_scope(db, user, warehouse_id)

# CORRECT — tenant check first, then warehouse check
wh = get_warehouse(db, warehouse_id)
enforce_tenant_scope(wh.tenant_id, user.tenant_id)
enforce_warehouse_scope(db, user, warehouse_id)
```

### 2. Don't Hardcode Tenant IDs

```python
# WRONG — hardcoded tenant
UserRole(user_id=user_sub, role_id=role.id, tenant_id=UUID("fixed-uuid"))

# CORRECT — always from the resolved user context
UserRole(user_id=user_sub, role_id=role.id, tenant_id=user.tenant_id)
```

### 3. `warehouse.global` Is Tenant-Scoped

```python
# warehouse.global means "all warehouses within my tenant"
# It does NOT mean "all warehouses across all tenants"
_GLOBAL_PERMISSIONS = {"warehouse.global"}
```

### 4. Bootstrap Only Fires Once

If the first user's email doesn't match `admin_email`, bootstrap won't fire for them. You'll need to manually assign roles via the IAM API or database.

### 5. Soft Delete Doesn't Touch Keycloak

```python
soft_delete_user(db, user_sub)
# Must also disable in Keycloak via Admin API:
# PUT /admin/realms/warehouselens/users/{sub}  {"enabled": false}
```

### 6. `created_by` Is Metadata Only

The `created_by` column records who performed an action but doesn't enforce access control. It's for audit trails, not authorization.

---

## Files Reference

| File | Purpose |
|------|---------|
| `backend/app/models/tenant.py` | `Tenant`, `User`, `UserTenant` models |
| `backend/app/models/authorization.py` | `UserRole` (with `tenant_id`), `AccessDecision` (with `created_by`) |
| `backend/app/models/warehouse.py` | `Warehouse` (with `tenant_id`) |
| `backend/app/core/security.py` | `CurrentUser.tenant_id`, `get_current_tenant()`, `upsert_user()`, `maybe_bootstrap_admin()`, `resolve_tenant_id()`, `enforce_tenant_scope()`, `soft_delete_user()` |
| `backend/app/services/permission_service.py` | `resolve_permissions(db, user_id, tenant_id)` |
| `backend/app/services/warehouse_service.py` | `list_warehouses(db, tenant_id)`, `create_warehouse(db, data, tenant_id)` |
| `backend/migrations/versions/0004_tenant_scoping.py` | Schema migration + seed |
| `backend/tests/conftest.py` | Test fixtures with tenant seeding |
| `docs/tenant-implementation-plan.md` | Original implementation plan |
