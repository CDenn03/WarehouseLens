# WarehouseLens — Permission Catalog & RBAC

This document covers the permission system refactored into a per-domain constants package: schema design, catalog architecture, role composition, enforcement flow, and how to add new permissions.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                       app/core/permissions/                         │
│                                                                     │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│   │ agent.py  │ │dashboard │ │ forecast │ │  iam.py  │  ...        │
│   │          │ │   .py    │ │   .py    │ │          │              │
│   │ CONSTANT │ │ CONSTANT │ │ CONSTANT │ │ CONSTANT │              │
│   │ = "x.y"  │ │ = "x.y"  │ │ = "x.y"  │ │ = "x.y"  │              │
│   │          │ │          │ │          │ │          │              │
│   │PERMISSIONS│ │PERMISSIONS│ │PERMISSIONS│ │PERMISSIONS│              │
│   │ = {..}   │ │ = {..}   │ │ = {..}   │ │ = {..}   │              │
│   └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘             │
│        │            │            │            │                     │
│        └────────────┴─────┬──────┴────────────┘                     │
│                           ▼                                         │
│                    __init__.py                                      │
│                    ALL_PERMISSIONS  (merged dict)                    │
│                    PERMISSION_CATEGORY (auto-derived)                │
│                    Collision check → ValueError                     │
│                           │                                         │
│                           ▼                                         │
│                      roles.py                                       │
│                      ROLE_DEFINITIONS  (composed from constants)     │
│                      ROLE_NAMES       (slug → display name)          │
└─────────────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
  ┌───────────────┐                   ┌───────────────┐
  │  Router files  │                   │   security.py │
  │  use constants │                   │   uses        │
  │  in endpoint  │                   │   ALL_PERMS   │
  │  decorators   │                   │   for global  │
  └───────────────┘                   │   permission  │
                                      └───────────────┘
```

Every permission is defined exactly once, as a named constant in its domain module. Typos fail at import time. Category is derived from the module name, so category and permission set can never silently drift apart.

---

## Design Principles

| Principle | How |
|-----------|-----|
| **Single source of truth** | Each permission is one constant in one file — never a raw string elsewhere |
| **Import-time safety** | Typos resolve to `NameError`; collisions raise `ValueError` at module load |
| **Category auto-derivation** | `PERMISSION_CATEGORY[pid]` is derived from the module name (`inventory.py` → `"inventory"`) |
| **Composable roles** | `ROLE_DEFINITIONS` references constants, never strings |
| **Deny-by-default** | If a permission is not in the resolved set, access is denied |
| **Tenant-scoped** | All permission resolution is scoped to a tenant (see `tenant-scoping.md`) |

---

## File Layout

```
backend/
├── app/
│   └── core/
│       └── permissions/
│           ├── __init__.py          # Aggregator: ALL_PERMISSIONS, PERMISSION_CATEGORY
│           ├── roles.py             # ROLE_DEFINITIONS, ROLE_NAMES
│           ├── agent.py             # AGENT_INVOKE
│           ├── dashboard.py         # DASHBOARD_READ
│           ├── forecast.py          # FORECAST_READ
│           ├── iam.py               # IAM_ROLE_MANAGE, IAM_USER_ROLE_ASSIGN
│           ├── inventory.py         # INVENTORY_READ, INVENTORY_WRITE, INVENTORY_PRODUCT_CREATE
│           ├── outbound.py          # OUTBOUND_SALES_ORDER_CREATE, OUTBOUND_TRANSFER_CREATE, ...
│           ├── procurement.py       # PROCUREMENT_SUPPLIER_CREATE, PROCUREMENT_ORDER_CREATE, ...
│           └── warehouse.py         # WAREHOUSE_CREATE, WAREHOUSE_ASSIGN_USER, WAREHOUSE_GLOBAL
├── scripts/
│   └── seed_permissions.py          # Idempotent DB seed from constants
└── tests/
    └── test_permissions_catalog.py  # Catalog integrity tests
```

---

## Permission Catalog (18 permissions)

### Domain: agent

| Constant | Permission ID | Description |
|----------|---------------|-------------|
| `AGENT_INVOKE` | `agent.invoke` | Invoke the AI agent |

### Domain: dashboard

| Constant | Permission ID | Description |
|----------|---------------|-------------|
| `DASHBOARD_READ` | `dashboard.read` | View dashboard |

### Domain: forecast

| Constant | Permission ID | Description |
|----------|---------------|-------------|
| `FORECAST_READ` | `forecast.read` | View forecasts |

### Domain: iam

| Constant | Permission ID | Description |
|----------|---------------|-------------|
| `IAM_ROLE_MANAGE` | `iam.role.manage` | Create/edit roles, assign permissions to roles |
| `IAM_USER_ROLE_ASSIGN` | `iam.user_role.assign` | Assign/revoke roles for a user within a tenant |

### Domain: inventory

| Constant | Permission ID | Description |
|----------|---------------|-------------|
| `INVENTORY_READ` | `inventory.read` | View inventory |
| `INVENTORY_WRITE` | `inventory.write` | Create inventory transactions |
| `INVENTORY_PRODUCT_CREATE` | `inventory.product.create` | Create products |

### Domain: outbound

| Constant | Permission ID | Description |
|----------|---------------|-------------|
| `OUTBOUND_SALES_ORDER_CREATE` | `outbound.sales_order.create` | Create sales orders |
| `OUTBOUND_TRANSFER_CREATE` | `outbound.transfer.create` | Create internal transfers |
| `OUTBOUND_PICK_LIST_MANAGE` | `outbound.pick_list.manage` | Generate and complete pick lists |
| `OUTBOUND_SHIP_MANAGE` | `outbound.ship.manage` | Ship and deliver outbound requests |

### Domain: procurement

| Constant | Permission ID | Description |
|----------|---------------|-------------|
| `PROCUREMENT_SUPPLIER_CREATE` | `procurement.supplier.create` | Create suppliers |
| `PROCUREMENT_ORDER_CREATE` | `procurement.order.create` | Create purchase orders |
| `PROCUREMENT_ORDER_RECEIVE` | `procurement.order.receive` | Receive purchase orders |

### Domain: warehouse

| Constant | Permission ID | Description |
|----------|---------------|-------------|
| `WAREHOUSE_CREATE` | `warehouse.create` | Create warehouses |
| `WAREHOUSE_ASSIGN_USER` | `warehouse.assign_user` | Assign users to warehouses |
| `WAREHOUSE_GLOBAL` | `warehouse.global` | Global warehouse scope |

---

## Role Definitions (5 roles)

### admin

All permissions **except** `iam.role.manage` and `iam.user_role.assign` (IAM is managed by `iam_admin`).

### warehouse_manager

- `inventory.read`, `inventory.write`, `inventory.product.create`
- `outbound.sales_order.create`, `outbound.transfer.create`, `outbound.pick_list.manage`, `outbound.ship.manage`
- `dashboard.read`, `forecast.read`, `agent.invoke`

### procurement_officer

- `procurement.supplier.create`, `procurement.order.create`, `procurement.order.receive`
- `inventory.read`, `inventory.product.create`
- `warehouse.global` (must target any warehouse for POs)
- `dashboard.read`, `forecast.read`, `agent.invoke`

### auditor

- `inventory.read`, `dashboard.read`, `forecast.read`
- `warehouse.global` (read-only access across all warehouses)

### iam_admin

- `iam.role.manage`, `iam.user_role.assign`

---

## How Permission Checking Works

```
Request → get_current_user (identity from JWT/debug header)
              │
              ▼
         require_permission("inventory.write")
              │
              ├── 1. resolve_permissions(db, user_id, tenant_id)
              │       → queries user_roles WHERE user_id = ? AND tenant_id = ?
              │       → queries role_permissions WHERE role_id IN (...)
              │       → returns set[str] of permission IDs
              │
              ├── 2. Is "inventory.write" in that set?
              │       YES → allow (return CurrentUser with permissions attached)
              │       NO  → 403 Forbidden
              │
              └── 3. Log decision (user_id, permission, decision, request_id)
```

### Key properties

- **Deny-by-default**: If `resolve_permissions()` returns an empty set (no roles, no permissions), every `require_permission()` call denies.
- **Tenant-scoped**: `resolve_permissions()` filters `user_roles` by `tenant_id`. A user in tenant A has no permissions in tenant B.
- **No caching**: Permissions are resolved from the DB on every request. Add caching only after performance measurements show a bottleneck.
- **Audit trail**: Every decision (allow/deny) is logged with structured fields for observability.

---

## How to Add a New Permission

1. **Create or edit the domain file** in `app/core/permissions/`:

```python
# app/core/permissions/inventory.py

INVENTORY_READ = "inventory.read"
INVENTORY_WRITE = "inventory.write"
INVENTORY_PRODUCT_CREATE = "inventory.product.create"
INVENTORY_CYCLE_COUNT = "inventory.cycle_count"  # ← new

PERMISSIONS = {
    INVENTORY_READ: "View inventory",
    INVENTORY_WRITE: "Create inventory transactions",
    INVENTORY_PRODUCT_CREATE: "Create products",
    INVENTORY_CYCLE_COUNT: "Run cycle counts",  # ← new
}
```

2. **Add it to roles** in `app/core/permissions/roles.py`:

```python
from .inventory import INVENTORY_READ, INVENTORY_WRITE, INVENTORY_PRODUCT_CREATE, INVENTORY_CYCLE_COUNT

ROLE_DEFINITIONS: dict[str, set[str]] = {
    "admin": set(ALL_PERMISSIONS) - {IAM_ROLE_MANAGE, IAM_USER_ROLE_ASSIGN},
    "warehouse_manager": {
        INVENTORY_READ, INVENTORY_WRITE, INVENTORY_PRODUCT_CREATE,
        INVENTORY_CYCLE_COUNT,  # ← new
        ...
    },
    ...
}
```

3. **Use the constant in your router**:

```python
from app.core.permissions.inventory import INVENTORY_CYCLE_COUNT

@router.post("/cycle-count")
def run_cycle_count(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_permission(INVENTORY_CYCLE_COUNT)),
):
    ...
```

4. **Update the seed script** if needed:

```bash
python -m scripts.seed_permissions
```

5. **Add tests** in `tests/test_permissions_catalog.py`:

```python
def test_cycle_count_exists(self):
    assert INVENTORY_CYCLE_COUNT in ALL_PERMISSIONS
```

6. **Run the test suite**:

```bash
python -m pytest tests/ -v
```

The catalog aggregator automatically:
- Merges the new permission into `ALL_PERMISSIONS`
- Derives the category (`"inventory"` from the module name)
- Checks for collisions with other modules

---

## How to Add a New Role

1. **Define the role** in `app/core/permissions/roles.py`:

```python
ROLE_DEFINITIONS: dict[str, set[str]] = {
    ...
    "cycle_counter": {
        INVENTORY_READ,
        INVENTORY_CYCLE_COUNT,
        DASHBOARD_READ,
    },
}

ROLE_NAMES: dict[str, str] = {
    ...
    "cycle_counter": "Cycle Counter",
}
```

2. **Use the constant in security or seed scripts**:

```python
from app.core.permissions.roles import ROLE_DEFINITIONS, ROLE_NAMES

# In a migration or seed script:
for slug, perms in ROLE_DEFINITIONS.items():
    role = Role(slug=slug, name=ROLE_NAMES[slug])
    session.add(role)
    for pid in perms:
        session.add(RolePermission(role_id=role.id, permission_id=pid))
```

3. **Run tests** to verify the new role's permissions are a subset of `ALL_PERMISSIONS`.

---

## How to Add a New Domain

1. **Create a new module** in `app/core/permissions/`:

```python
# app/core/permissions/returns.py

RETURNS_CREATE = "returns.create"
RETURNS_APPROVE = "returns.approve"

PERMISSIONS = {
    RETURNS_CREATE: "Create return requests",
    RETURNS_APPROVE: "Approve return requests",
}
```

2. **Register it** in `app/core/permissions/__init__.py`:

```python
from . import (
    agent,
    dashboard,
    forecast,
    iam,
    inventory,
    outbound,
    procurement,
    returns,   # ← new
    warehouse,
)

_MODULES = [agent, dashboard, forecast, iam, inventory, outbound, procurement, returns, warehouse]
```

3. **Add it to roles** and routers as needed.

The aggregator will:
- Check for collisions with existing permission IDs
- Derive the category as `"returns"` from the module name
- Add both permissions to `ALL_PERMISSIONS`

---

## DB Seed Script

`scripts/seed_permissions.py` upserts the permission catalog and role mappings into the database. It is idempotent and safe to run multiple times.

```bash
# From the backend directory:
python -m scripts.seed_permissions

# Or with explicit DATABASE_URL override:
DATABASE_URL=postgres://user:pass@localhost/warehouselens python -m scripts.seed_permissions
```

What it does:
1. Upserts all 18 permissions from `ALL_PERMISSIONS` (updates descriptions if they change)
2. Upserts all 5 roles from `ROLE_DEFINITIONS` (creates if missing)
3. Deletes and re-inserts role→permission mappings from `ROLE_DEFINITIONS` (authoritative source)

---

## Test Coverage

`tests/test_permissions_catalog.py` (13 tests) verifies:

### Overlap Detection
- `test_all_permission_keys_unique` — catalog has no duplicate keys
- `test_overlap_raises_valueerror` — simulating a collision raises `ValueError`

### Role Subset Validation
- `test_every_role_permission_is_in_catalog` — every role permission exists in `ALL_PERMISSIONS`
- `test_role_definitions_keys_match_role_names` — `ROLE_DEFINITIONS` and `ROLE_NAMES` have same keys
- `test_role_permissions_are_lists` — every role's permissions are a collection
- `test_no_empty_roles` — every role has at least one permission

### Catalog Shape
- `test_permission_ids_are_strings` — all IDs are strings
- `test_permission_descriptions_are_strings` — all descriptions are strings
- `test_permission_categories_are_strings` — all categories are strings
- `test_permission_ids_match_category_format` — IDs are `domain.action` format
- `test_categories_match_domain_prefixes` — category matches the domain prefix
- `test_all_permissions_has_no_duplicates` — exactly 18 permissions
- `test_role_definitions_has_5_roles` — exactly 5 roles

---

## Permission × Endpoint Reference

| Endpoint | Required Permission | Domain |
|----------|-------------------|--------|
| `GET /api/v1/dashboard/kpis` | `dashboard.read` | dashboard |
| `GET /api/v1/dashboard/charts/stock-trend` | `dashboard.read` | dashboard |
| `GET /api/v1/dashboard/charts/abc-ranking` | `dashboard.read` | dashboard |
| `GET /api/v1/forecast/{id}` | `forecast.read` | forecast |
| `POST /api/v1/agent/query` | `agent.invoke` | agent |
| `GET /api/v1/products` | `inventory.read` | inventory |
| `POST /api/v1/products` | `inventory.product.create` | inventory |
| `POST /api/v1/inventory/transactions` | `inventory.write` | inventory |
| `GET /api/v1/warehouses` | `get_current_user` (identity only) | — |
| `POST /api/v1/warehouses` | `warehouse.create` | warehouse |
| `POST /api/v1/warehouses/{id}/assignments` | `warehouse.assign_user` | warehouse |
| `GET /api/v1/suppliers` | `get_current_user` (identity only) | — |
| `POST /api/v1/suppliers` | `procurement.supplier.create` | procurement |
| `GET /api/v1/purchase-orders` | `get_current_user` (identity only) | — |
| `POST /api/v1/purchase-orders` | `procurement.order.create` | procurement |
| `POST /api/v1/purchase-orders/{id}/receive` | `procurement.order.receive` | procurement |
| `POST /api/v1/sales-orders` | `outbound.sales_order.create` | outbound |
| `POST /api/v1/transfers` | `outbound.transfer.create` | outbound |
| `POST /api/v1/pick-lists` | `outbound.pick_list.manage` | outbound |
| `POST /api/v1/shipments/{id}/ship` | `outbound.ship.manage` | outbound |
| `POST /api/v1/shipments/{id}/deliver` | `outbound.ship.manage` | outbound |
| `POST /api/v1/iam/roles` | `iam.role.manage` | iam |
| `POST /api/v1/iam/users/{id}/roles` | `iam.user_role.assign` | iam |

---

## File Reference

| File | Purpose |
|------|---------|
| `app/core/permissions/__init__.py` | Aggregator: `ALL_PERMISSIONS`, `PERMISSION_CATEGORY`, collision check |
| `app/core/permissions/roles.py` | `ROLE_DEFINITIONS`, `ROLE_NAMES` composed from constants |
| `app/core/permissions/agent.py` | `AGENT_INVOKE` |
| `app/core/permissions/dashboard.py` | `DASHBOARD_READ` |
| `app/core/permissions/forecast.py` | `FORECAST_READ` |
| `app/core/permissions/iam.py` | `IAM_ROLE_MANAGE`, `IAM_USER_ROLE_ASSIGN` |
| `app/core/permissions/inventory.py` | `INVENTORY_READ`, `INVENTORY_WRITE`, `INVENTORY_PRODUCT_CREATE` |
| `app/core/permissions/outbound.py` | `OUTBOUND_SALES_ORDER_CREATE`, `OUTBOUND_TRANSFER_CREATE`, `OUTBOUND_PICK_LIST_MANAGE`, `OUTBOUND_SHIP_MANAGE` |
| `app/core/permissions/procurement.py` | `PROCUREMENT_SUPPLIER_CREATE`, `PROCUREMENT_ORDER_CREATE`, `PROCUREMENT_ORDER_RECEIVE` |
| `app/core/permissions/warehouse.py` | `WAREHOUSE_CREATE`, `WAREHOUSE_ASSIGN_USER`, `WAREHOUSE_GLOBAL` |
| `app/services/permission_service.py` | `resolve_permissions(db, user_id, tenant_id)` — DB lookup |
| `app/core/security.py` | `require_permission()` — router dependency, logs decisions |
| `scripts/seed_permissions.py` | Idempotent DB seed from constants |
| `tests/test_permissions_catalog.py` | 13 catalog integrity tests |

---

## Common Pitfalls

| Pitfall | Prevention |
|---------|------------|
| Using a raw string instead of the constant | The constant is defined once; grep for permission strings to catch stragglers |
| Adding a permission but forgetting to add it to any role | `test_no_empty_roles` + `test_every_role_permission_is_in_catalog` catch this |
| Two modules defining the same permission ID | Aggregator raises `ValueError` at import time |
| Category drifting from domain prefix | `PERMISSION_CATEGORY` is auto-derived from the module name |
| Role referencing a nonexistent permission | `test_every_role_permission_is_in_catalog` fails |
| Forgetting to seed new permissions in the DB | `scripts/seed_permissions.py` is idempotent — run it after any catalog change |
| Permission not imported in router | `NameError` at import time — fail-fast |
| Admin accidentally losing a permission | Admin is `set(ALL_PERMISSIONS) - {IAM_ROLE_MANAGE, IAM_USER_ROLE_ASSIGN}` — gains any new permission automatically |
