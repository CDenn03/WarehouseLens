# Tenant-Ready User Management — Implementation Plan

## Pre-Implementation: Key Design Decisions

### `users.id` Type
The prompt specifies `UUID PRIMARY KEY`, but all existing `user_id` columns (`user_roles`, `user_warehouse_assignments`, `access_decisions`) are `String(120)`. PostgreSQL cannot create a FK from VARCHAR to UUID. Decision: **`users.id` will be `String(120)`** to match the existing convention, keep test data working (test subs like `sub-admin` are not UUID-formatted), and allow FK constraints from `user_tenants.user_id` and `created_by` columns. The Keycloak sub is semantically a string identifier — storing it as `String(120)` is functionally identical.

### `UserRole` FK to `users`
`user_roles.user_id` stays `String(120)` without a FK to `users.id` (type mismatch). The logical relationship is documented. The same applies to `user_warehouse_assignments.user_id` and `access_decisions.user_id`.

### `enforce_tenant_scope()` Signature
Takes `(resource_tenant_id: UUID, current_tenant_id: UUID)` — a pure comparison. The caller resolves the resource's `tenant_id` (e.g., from the warehouse object). This keeps the function simple and composable.

### Bootstrap Flow
Bootstrap is a one-time-per-tenant operation gated on "does ANY role row exist for this tenant." If no `user_tenants` row exists for the caller AND bootstrap conditions are met, `maybe_bootstrap_admin()` creates both the `user_tenants` row AND the `iam_admin` `user_roles` row in one shot. If bootstrap conditions aren't met (wrong email, not verified, or bootstrap already fired), the user gets 403.

---

## Deliverable 1: Migration `0004_tenant_scoping.py`

### New Tables
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    superuser_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id VARCHAR(120) PRIMARY KEY,       -- Keycloak `sub`, never regenerated
    email TEXT NOT NULL,
    username TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE user_tenants (
    user_id VARCHAR(120) NOT NULL REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    PRIMARY KEY (user_id, tenant_id)
);
```

### Seed Default Tenant
```sql
INSERT INTO tenants (name, superuser_email)
VALUES ('default', COALESCE(current_setting('app.default_tenant_superuser_email', true), 'admin@warehouselens.local'));
```
Note: Alembic reads env vars via `os.environ`, not Postgres `current_setting`. The migration will use Python to read `DEFAULT_TENANT_SUPERUSER_EMAIL` env var with fallback.

### Alter Existing Tables
```sql
ALTER TABLE user_roles ADD COLUMN tenant_id UUID NOT NULL REFERENCES tenants(id);
ALTER TABLE warehouses ADD COLUMN tenant_id UUID NOT NULL REFERENCES tenants(id);
ALTER TABLE user_roles ADD PRIMARY KEY (user_id, role_id, tenant_id);  -- alter composite PK
```

### Backfill
```sql
UPDATE user_roles SET tenant_id = (SELECT id FROM tenants WHERE name = 'default');
UPDATE warehouses SET tenant_id = (SELECT id FROM tenants WHERE name = 'default');
```

### `created_by` Columns (7 tables)
```sql
ALTER TABLE inventory_transactions ADD COLUMN created_by VARCHAR(120) REFERENCES users(id);
ALTER TABLE access_decisions ADD COLUMN created_by VARCHAR(120) REFERENCES users(id);
ALTER TABLE purchase_orders ADD COLUMN created_by VARCHAR(120) REFERENCES users(id);
ALTER TABLE sales_orders ADD COLUMN created_by VARCHAR(120) REFERENCES users(id);
ALTER TABLE outbound_requests ADD COLUMN created_by VARCHAR(120) REFERENCES users(id);
ALTER TABLE pick_lists ADD COLUMN created_by VARCHAR(120) REFERENCES users(id);
ALTER TABLE shipments ADD COLUMN created_by VARCHAR(120) REFERENCES users(id);
```

### New Permissions + Role
```sql
INSERT INTO permissions (id, description, category) VALUES
    ('iam.role.manage', 'Create/edit roles, assign permissions to roles', 'iam'),
    ('iam.user_role.assign', 'Assign/revoke roles for a user within a tenant', 'iam');

INSERT INTO roles (id, slug, name) VALUES
    ('a0000000-0000-0000-0000-000000000005', 'iam_admin', 'IAM Admin');

INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('a0000000-0000-0000-0000-000000000005', 'iam.role.manage'),
    ('a0000000-0000-0000-0000-000000000005', 'iam.user_role.assign');
```

### Indexes
```sql
CREATE INDEX idx_user_roles_tenant ON user_roles (tenant_id);
CREATE INDEX idx_warehouses_tenant ON warehouses (tenant_id);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_user_tenants_tenant ON user_tenants (tenant_id);
```

---

## Deliverable 2: SQLAlchemy Models

### New File: `backend/app/models/tenant.py`
```python
class Tenant(Base, UuidPkMixin, CreatedAtMixin):
    __tablename__ = "tenants"
    name: Mapped[str] = mapped_column(Text, nullable=False)
    superuser_email: Mapped[str | None] = mapped_column(Text, nullable=True)

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class UserTenant(Base):
    __tablename__ = "user_tenants"
    user_id: Mapped[str] = mapped_column(String(120), ForeignKey("users.id"), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), primary_key=True)
```

### Updated `authorization.py`
- `UserRole`: add `tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), primary_key=True)`

### Updated `warehouse.py`
- `Warehouse`: add `tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"))`

### Updated State-Changing Models
Add `created_by: Mapped[str | None] = mapped_column(String(120), ForeignKey("users.id"), nullable=True)` to:
- `InventoryTransaction` (`inventory.py`)
- `AccessDecision` (`authorization.py`)
- `PurchaseOrder` (`procurement.py`)
- `SalesOrder` (`outbound.py`)
- `OutboundRequest` (`outbound.py`)
- `PickList` (`outbound.py`)
- `Shipment` (`outbound.py`)

### Updated `models/__init__.py`
Add imports for `Tenant`, `User`, `UserTenant`.

---

## Deliverable 3: Security & Permission Changes

### `security.py` Changes

**`CurrentUser`** — add `tenant_id: UUID | None = None`

**New functions:**

1. **`get_current_tenant(db, user_sub) -> UUID`**
   - Query `user_tenants` for this sub
   - Raise `ForbiddenError("No tenant membership")` if not found
   - Returns the `tenant_id`

2. **`upsert_user(db, sub, email, username)`**
   - INSERT INTO users ... ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, username=EXCLUDED.username
   - Only update if email or username actually changed (check before upsert)
   - Called from `get_current_user()`

3. **`maybe_bootstrap_admin(db, user_sub, user_email, email_verified) -> UUID | None`**
   - Find default tenant (name='default')
   - Check if ANY `user_roles` rows exist for that tenant → if yes, return None (bootstrap already fired)
   - Check `email_verified` and email match (case-insensitive) against `tenant.superuser_email`
   - If match: create `user_tenants` row + `user_roles` row (iam_admin, tenant-scoped)
   - Flush (don't commit — caller manages transaction)
   - Return tenant_id or None

4. **`enforce_tenant_scope(resource_tenant_id, current_tenant_id)`**
   - Compare two UUIDs, raise `ForbiddenError("cross-tenant access denied")` on mismatch
   - Hard boundary, no bypass permission

5. **`soft_delete_user(db, user_sub)`**
   - Set `deleted_at = now()` on `users` row
   - Delete `user_roles` rows for this user in all tenants
   - Delete `user_tenants` rows for this user
   - Flush in a savepoint (not full commit — caller manages)

**Updated functions:**

- **`resolve_permissions(db, user_id, tenant_id)`** — filter `user_roles` by both `user_id` AND `tenant_id`
- **`get_current_user()`** — add `db: Session = Depends(get_db)`:
  - After resolving identity (JWT or debug header): call `upsert_user()`
  - Call `get_current_tenant()` or `maybe_bootstrap_admin()` if no membership
  - Return `CurrentUser` with `tenant_id`
- **`require_permission()`** — pass `user.tenant_id` to `resolve_permissions()`
- **`_ensure_permissions()`** — pass `user.tenant_id` to `resolve_permissions()`
- **`assigned_warehouse_ids()`** — JOIN through `warehouses` to filter by `Warehouse.tenant_id == user.tenant_id`

### `permission_service.py` Changes
- `resolve_permissions(db, user_id, tenant_id)` — add `WHERE tenant_id = :tenant_id` to the user_roles query
- `log_access_decision()` — unchanged (already takes explicit params)

---

## Deliverable 4: Endpoint Tenant Threading

### Endpoints Needing Explicit `enforce_tenant_scope()` Call
These are mutation endpoints that create resources tied to a warehouse:

| Endpoint | File:Line | Resource's tenant_id source |
|---|---|---|
| `POST /warehouses` | `warehouses.py:20` | New warehouse gets current tenant_id |
| `POST /warehouses/{id}/assignments` | `warehouses.py:29` | Look up warehouse.tenant_id |
| `POST /products` | `inventory.py:31` | Products are global (no tenant_id) — skip |
| `POST /inventory/transactions` | `inventory.py:67` | Look up warehouse.tenant_id |
| `POST /suppliers` | `procurement.py:29` | Suppliers are global — skip |
| `POST /purchase-orders` | `procurement.py:51` | Look up warehouse.tenant_id |
| `POST /purchase-orders/{id}/receive` | `procurement.py:61` | Look up warehouse.tenant_id |
| `POST /sales-orders` | `outbound.py:32` | Look up warehouse.tenant_id |
| `POST /outbound-requests` | `outbound.py:69` | Look up warehouse.tenant_id |
| `POST /outbound-requests/{id}/pick-lists` | `outbound.py:79` | Look up warehouse.tenant_id |
| `POST /pick-lists/{id}/items/{id}` | `outbound.py:91` | Look up via pick_list→outbound_request→warehouse |
| `POST /pick-lists/{id}/complete` | `outbound.py:104` | Same as above |
| `POST /outbound-requests/{id}/ship` | `outbound.py:115` | Look up via outbound_request→warehouse |
| `PATCH /shipments/{id}/deliver` | `outbound.py:127` | Look up via shipment→outbound_request→warehouse |
| `POST /agent/query` | `agent.py:12` | Look up warehouse.tenant_id if warehouse_id provided |

**Note:** For list/read endpoints, tenant scoping is implicit via `scope_filter_warehouse_ids()` (which now filters by tenant). No explicit `enforce_tenant_scope()` needed.

**Note:** `products` and `suppliers` are global catalog tables (no `tenant_id` column). They're shared across tenants. Individual warehouse scoping handles access control.

### `create_warehouse()` Change
The `create_warehouse()` service function must set `tenant_id` on the new warehouse:
```python
def create_warehouse(db, data, tenant_id):
    wh = Warehouse(name=data.name, address=data.address, tenant_id=tenant_id)
```

---

## Deliverable 5: Test Changes

### Updated `conftest.py`
- Add default tenant to `_seed_permissions_and_roles()`:
  ```python
  default_tenant = Tenant(name="default", superuser_email="admin@test.local")
  db_session.add(default_tenant)
  db_session.flush()
  ```
- Create `users` rows for test users (ADMIN_USER, AUDITOR_USER, NAIROBI_MANAGER_USER)
- Create `user_tenants` rows linking each user to the default tenant
- Pass `tenant_id=default_tenant.id` to all `UserRole` inserts
- Pass `tenant_id=default_tenant.id` to all `Warehouse` inserts
- Return `default_tenant` in the seeded fixture dict

### New File: `tests/test_tenant_scoping.py`

**Test 1: Cross-tenant warehouse.global isolation**
- Create a second tenant, warehouse in tenant B
- User has `warehouse.global` + admin role in tenant A only
- Verify: can read tenant A's warehouses, 403 on tenant B's

**Test 2: Bootstrap idempotency**
- First login by superuser → bootstrap fires, iam_admin role created
- Second login by same user → bootstrap does NOT fire (role count stays 1)
- Third login by different user with wrong email → no bootstrap, no role

**Test 3: Soft-deleted user**
- Create user, assign role, soft-delete
- Verify: `get_current_user()` raises 401/403
- Verify: historical `created_by` references still resolve (JOIN returns username)

**Test 4: Tenant scope enforcement**
- `enforce_tenant_scope(tenant_a, tenant_a)` → passes
- `enforce_tenant_scope(tenant_a, tenant_b)` → raises 403

**Test 5: X-Debug-User respects tenant**
- Debug header user with no tenant membership → 403
- Debug header user with tenant membership → works

---

## Deliverable 6: Migration Comment Block

Top of `0004_tenant_scoping.py`:
```python
"""Add tenant scoping and IAM foundations.

ENDPOINT TENANT FILTER CHECKLIST (for PR review):
- [x] POST /warehouses — tenant_id set on create
- [x] POST /warehouses/{id}/assignments — warehouse.tenant_id checked
- [x] POST /inventory/transactions — warehouse.tenant_id checked
- [x] POST /purchase-orders — warehouse.tenant_id checked
- [x] POST /purchase-orders/{id}/receive — warehouse.tenant_id checked
- [x] POST /sales-orders — warehouse.tenant_id checked
- [x] POST /outbound-requests — warehouse.tenant_id checked
- [x] POST /outbound-requests/{id}/pick-lists — warehouse.tenant_id checked
- [x] POST /pick-lists/{id}/items/{id} — warehouse.tenant_id checked
- [x] POST /pick-lists/{id}/complete — warehouse.tenant_id checked
- [x] POST /outbound-requests/{id}/ship — warehouse.tenant_id checked
- [x] PATCH /shipments/{id}/deliver — warehouse.tenant_id checked
- [x] POST /agent/query — warehouse.tenant_id checked
- [x] GET /products — implicit via scope_filter_warehouse_ids (tenant-scoped)
- [x] GET /products/{id}/stock — implicit via scope_filter_warehouse_ids
- [x] GET /inventory/transactions — implicit via scope_filter_warehouse_ids
- [x] GET /suppliers — global catalog, no tenant filter needed
- [x] GET /purchase-orders — implicit via scope_filter_warehouse_ids
- [x] GET /outbound-requests — implicit via scope_filter_warehouse_ids
- [x] GET /outbound-requests/{id} — implicit via warehouse.tenant_id
- [x] GET /dashboard/kpis — implicit via scope_filter_warehouse_ids
- [x] GET /dashboard/charts/* — implicit via scope_filter_warehouse_ids
- [x] GET /forecast/{id} — implicit via enforce_warehouse_scope
"""
```

---

## Implementation Order

1. **Migration** (`0004_tenant_scoping.py`) — schema + seed + backfill
2. **Models** — new `tenant.py`, update `authorization.py`, `warehouse.py`, `inventory.py`, `outbound.py`, `procurement.py`, `__init__.py`
3. **`permission_service.py`** — add `tenant_id` param to `resolve_permissions()`
4. **`security.py`** — all new functions + update existing ones
5. **API endpoints** — thread `enforce_tenant_scope()`, update `create_warehouse()` signature
6. **Test conftest** — seed tenants, users, user_tenants
7. **New tests** — `test_tenant_scoping.py`
8. **Run tests** — verify all existing + new tests pass
9. **Lint/typecheck** — `ruff check`, `mypy` if configured
