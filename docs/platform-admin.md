# WarehouseLens — Platform Admin

This document covers the two-level identity model: the Platform Admin who manages tenants, and the Tenant Admin who manages users within a tenant.

---

## Two-level identity model

```
Platform Admin (platform pseudo-tenant)
  │  can: create tenants, assign superuser emails, manage other platform admins
  │
  └── Tenant (e.g. "acme-corp")
        │  has: warehouses, users, roles
        │
        └── Tenant Admin (tenant_admin role)
              │  can: assign roles to users, assign warehouses to users
              │
              └── Operators (warehouse_manager, procurement_officer, auditor, admin)
```

The two levels are cleanly separated:

- A Platform Admin **cannot** see tenant operational data (inventory, outbound, procurement). Their `tenant_id` resolves to the platform pseudo-tenant which has no warehouses.
- A Tenant Admin **cannot** create or list tenants. They operate entirely within their own tenant boundary.

---

## The platform pseudo-tenant

The `tenants` table has an `is_platform` boolean column. There is exactly one row with `is_platform = true`, seeded by migration 0006. It is named `"platform"` and has no warehouses.

All `platform_admin` role assignments live in `user_roles` scoped to this pseudo-tenant. All platform API endpoints resolve the caller's `tenant_id` from the normal `user_tenants` lookup — if it resolves to the platform pseudo-tenant, the caller is a platform admin.

Tenant-listing queries always filter `WHERE is_platform = false`, so the platform pseudo-tenant never appears in the tenant list.

---

## Bootstrap flow

### Platform Admin bootstrap

On first login by the user whose Keycloak email matches `PLATFORM_ADMIN_EMAIL`:

1. `resolve_tenant_id()` finds no existing `user_tenants` row.
2. It calls `bootstrap_platform_admin()`.
3. That function checks: does the platform pseudo-tenant have a real (non-placeholder) role assignment? If not, and the email matches, it:
   - Deletes the migration-time placeholder user row
   - Creates a `user_tenants` row pointing to the platform pseudo-tenant
   - Creates a `user_roles` row for `platform_admin`
4. Returns the platform tenant_id.

After this fires once, additional platform admins are assigned via the platform dashboard (`POST /platform/admins`).

### Tenant Admin bootstrap

On first login by the user whose Keycloak email matches `DEFAULT_TENANT_SUPERUSER_EMAIL`:

1. `resolve_tenant_id()` finds no existing `user_tenants` row.
2. It calls `maybe_bootstrap_admin()`.
3. That function checks: does the default tenant have zero `user_roles` rows? If yes and the email matches:
   - Creates a `user_tenants` row for the default tenant
   - Creates a `user_roles` row for `tenant_admin`
4. After the first `user_roles` row exists for the tenant, this function never fires again.

After bootstrap, the Tenant Admin uses the IAM admin UI (`/admin/users`) to assign roles to other users.

---

## Roles

| Role | Scope | Permissions |
|---|---|---|
| `platform_admin` | Platform pseudo-tenant | `dashboard.platform`, `platform.tenant.manage` |
| `tenant_admin` | Tenant | `iam.role.manage`, `iam.user_role.assign`, `iam.user.read`, `warehouse.create`, `warehouse.assign_user` |
| `admin` | Tenant | All permissions except IAM and platform |
| `warehouse_manager` | Tenant | Inventory + outbound + dashboard + forecast + agent |
| `procurement_officer` | Tenant | Procurement + inventory.read + warehouse.global + dashboard + forecast + agent |
| `auditor` | Tenant | inventory.read + dashboard.read + forecast.read + warehouse.global |

---

## Platform API endpoints

All endpoints require `platform.tenant.manage`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/platform/tenants` | List all non-platform tenants |
| `POST` | `/api/v1/platform/tenants` | Create a new tenant |
| `GET` | `/api/v1/platform/tenants/{id}` | Get tenant detail |
| `GET` | `/api/v1/platform/admins` | List platform admins |
| `POST` | `/api/v1/platform/admins` | Assign platform_admin to a user |
| `DELETE` | `/api/v1/platform/admins/{user_id}` | Revoke platform_admin from a user |

### Creating a tenant

```json
POST /api/v1/platform/tenants
{
  "name": "acme-corp",
  "superuser_email": "admin@acme-corp.com"
}
```

The `superuser_email` is stored on the tenant row. When the matching user logs in for the first time to that tenant (i.e. has no `user_tenants` row), `maybe_bootstrap_admin()` assigns them `tenant_admin`.

### Self-lockout protection

`DELETE /platform/admins/{user_id}` checks whether any other user holds `platform_admin` in the platform pseudo-tenant. If the target is the only one, the request is rejected with 409:

```json
{ "detail": "cannot remove the last platform admin; assign the role to another user first" }
```

---

## Frontend routes

| Route | Who sees it | What it does |
|---|---|---|
| `/dashboard` | All authenticated users | Role-dispatches: `platform_admin` → `/platform`, others → operational dashboard |
| `/platform` | `platform_admin` only | Tenant list, KPIs, platform admin management |
| `/admin/users` | `tenant_admin` (or admin with IAM perms) | User role + warehouse assignment management |

The Sidebar automatically shows the Platform nav item when the logged-in user holds `platform_admin`, and shows the full operational nav otherwise.

---

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `PLATFORM_ADMIN_EMAIL` | Email bootstrapped as first platform admin | `platform@warehouselens.local` |
| `DEFAULT_TENANT_SUPERUSER_EMAIL` | Email bootstrapped as first tenant admin | `admin@warehouselens.local` |

Both are read by `Settings` in `app/core/config.py` and available at runtime. The migration also reads them from the environment at migration time to seed the bootstrap placeholder.

---

## Adding a second platform admin

Once the first platform admin is logged in, go to `/platform` → Platform Admins section. The user must already exist in the `users` table (they need to have logged in at least once, or be manually inserted).

Via API:

```bash
POST /api/v1/platform/admins
X-Debug-User: <platform-admin-sub>:<username>:placeholder
Content-Type: application/json

{ "user_id": "<target-keycloak-sub>" }
```

---

## Onboarding a new tenant end to end

1. Platform Admin logs into `/platform`.
2. Clicks "New tenant", fills in name + superuser email, submits.
3. The new tenant row is created in the DB.
4. The person at `superuser_email` logs in via Keycloak.
5. `maybe_bootstrap_admin()` fires — they get `tenant_admin` for that tenant.
6. They go to `/admin/users`, create other users, assign roles and warehouses.
