# WarehouseLens — Platform Admin

This document covers the two-level identity model: the Platform Admin who manages tenants, and the Tenant Admin who manages users within a tenant.

---

## Two-level identity model

```
Platform Admin (platform pseudo-tenant)
  │  can: create/edit/delete tenants, provision their admins, manage other platform admins
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

### Tenant Admin provisioning

Tenants created through the platform API do **not** wait for a first-login bootstrap. `POST /platform/tenants` provisions the account up front:

1. `keycloak_admin.provision_user()` creates the Keycloak account for `admin_email` — enabled, email pre-verified, with the configured `INITIAL_ADMIN_PASSWORD` (`Changeme1`) marked **temporary** and the `UPDATE_PASSWORD` required action set.
2. The Keycloak `sub` becomes the primary key of the local `users` row, so the mirror is already correct before the person has ever signed in.
3. A `user_tenants` row and a `tenant_admin` `user_roles` row are written for the new tenant.
4. The response carries the temporary password **once** — the UI shows it and it is never readable again.

At first login Keycloak forces the password change before issuing a token; WarehouseLens sees an ordinary authenticated user with `tenant_admin`.

If the email already has a Keycloak account, it is reused: no password is touched, `created` comes back `false`, and the existing identity simply gains the `tenant_admin` role in the new tenant.

### Default-tenant bootstrap (legacy path)

Only the migration-seeded `default` tenant still relies on first-login bootstrap. On first login by the user whose Keycloak email matches `DEFAULT_TENANT_SUPERUSER_EMAIL`:

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
| `POST` | `/api/v1/platform/tenants` | Create a tenant + provision its admin |
| `GET` | `/api/v1/platform/tenants/{id}` | Get tenant detail |
| `PATCH` | `/api/v1/platform/tenants/{id}` | Rename, and/or provision a new admin |
| `DELETE` | `/api/v1/platform/tenants/{id}` | Delete a tenant |
| `POST` | `/api/v1/platform/tenants/{id}/admin/reset-password` | Reissue the admin's temporary password |
| `GET` | `/api/v1/platform/admins` | List platform admins |
| `POST` | `/api/v1/platform/admins` | Provision (by email) or promote (by user_id) a platform admin |
| `PATCH` | `/api/v1/platform/admins/{user_id}` | Update email / username (writes through to Keycloak) |
| `POST` | `/api/v1/platform/admins/{user_id}/reset-password` | Reissue a temporary password |
| `DELETE` | `/api/v1/platform/admins/{user_id}` | Revoke platform_admin from a user |

### Creating a tenant

```json
POST /api/v1/platform/tenants
{
  "name": "acme-corp",
  "admin_email": "admin@acme-corp.com"
}
```

Response (201):

```json
{
  "tenant": {
    "id": "…", "name": "acme-corp", "admin_email": "admin@acme-corp.com",
    "user_count": 1, "warehouse_count": 0, "admin_user_id": "<keycloak-sub>"
  },
  "admin": {
    "user_id": "<keycloak-sub>",
    "email": "admin@acme-corp.com",
    "created": true,
    "temporary_password": "Changeme1"
  }
}
```

`admin_email` is required — a tenant nobody can sign in to is not worth creating. `temporary_password` is `null` when the address already had an account (`created: false`), since an existing password is never reset behind its owner's back.

### Changing a tenant's admin

`PATCH` with a new `admin_email` provisions that person as an **additional** `tenant_admin` and updates the tenant row. The previous admin keeps their access on purpose: a typo in the new address must not lock the tenant out. Remove the old one from the tenant's own IAM screen once the handover is confirmed.

### Deleting a tenant

`DELETE` removes the tenant, its `user_tenants` rows and its `user_roles` rows. Two guards:

- **Warehouses block deletion** (409). All operational data hangs off a warehouse; deleting the tenant row underneath it would orphan that data silently.
- **Users left without any tenant** are soft-deleted locally and *disabled* (not deleted) in Keycloak, so their `sub` keeps resolving in audit history.

### Keycloak failures

Provisioning calls that cannot reach Keycloak, are rejected by it, or find no admin credentials configured return **502** with the upstream detail — never a partially created tenant, since Keycloak is called before the local transaction commits.

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
| `DEFAULT_TENANT_SUPERUSER_EMAIL` | Email bootstrapped as first tenant admin of the seeded `default` tenant | `admin@warehouselens.local` |
| `INITIAL_ADMIN_PASSWORD` | Temporary password issued to every provisioned admin | `Changeme1` |

Both bootstrap emails are read by `Settings` in `app/core/config.py` and available at runtime. The migration also reads them from the environment at migration time to seed the bootstrap placeholder.

### Keycloak Admin API

Provisioning needs admin credentials. URL and realm are derived from `KEYCLOAK_ISSUER_URL` when left blank.

| Variable | Description | Default |
|---|---|---|
| `KEYCLOAK_ADMIN_URL` | Keycloak base URL (no `/realms` suffix) | derived from issuer |
| `KEYCLOAK_REALM` | Realm the accounts live in | derived from issuer |
| `KEYCLOAK_ADMIN_AUTH_REALM` | Realm the admin token is obtained from | `master` |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Client used for the token request | `admin-cli` |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Service-account secret (preferred in production) | — |
| `KEYCLOAK_ADMIN_USERNAME` / `KEYCLOAK_ADMIN_PASSWORD` | Password-grant fallback (dev) | — |

A service-account client is preferred in production: set `KEYCLOAK_ADMIN_AUTH_REALM` to the app realm, give the client the `manage-users` realm-management role, and leave the username/password unset.

---

## Adding a second platform admin

Go to `/platform` → Platform Admins → **Add admin**. Two ways in:

- **By email** — provisions a Keycloak account and returns a one-time temporary password, exactly like a tenant admin.
- **By user id** — promotes someone who already exists in the `users` table (they have signed in at least once).

Via API:

```bash
POST /api/v1/platform/admins
Content-Type: application/json

{ "email": "ops@warehouselens.com" }      # provision
{ "user_id": "<target-keycloak-sub>" }     # promote
```

Exactly one of the two fields is accepted; sending both is a 422.

---

## Onboarding a new tenant end to end

1. Platform Admin logs into `/platform`.
2. Clicks "New tenant", fills in name + admin email, submits.
3. The tenant row, the Keycloak account, the local `users` row, the membership and the `tenant_admin` assignment are all created in that one request.
4. The UI shows the temporary password once — the platform admin passes it on.
5. The new admin signs in; Keycloak forces them to set a real password before a token is issued.
6. They go to `/admin/users`, add other users, and assign roles and warehouses.
