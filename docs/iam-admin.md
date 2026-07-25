# WarehouseLens — IAM Administration

This document covers user, role, and warehouse-assignment management for tenant admins: the API endpoints, the five required checks, and how to use the admin UI.

---

## Overview

IAM administration is the tenant-scoped layer below Platform Admin. A user holding `tenant_admin` can:

- View all users in their tenant and their current roles + warehouse assignments
- Assign or revoke roles from users
- Assign or revoke warehouse access from users

All operations are strictly within the caller's tenant. Cross-tenant access is structurally impossible — the API resolves `tenant_id` from the authenticated user's session, never from a client-supplied parameter.

---

## Database model

```
users
  ├── user_tenants     (user_id → tenant_id)   — membership
  ├── user_roles       (user_id, role_id, tenant_id) — capabilities
  └── user_warehouse_assignments (user_id, warehouse_id, assigned_at) — data scope
```

Roles and warehouse assignments are **independent**. A role grants capability (e.g. `inventory.write`); warehouse assignment grants data scope (which specific warehouses the user can act on). A `warehouse_manager` with no warehouse assignments can do nothing operationally.

Users with `warehouse.global` (auditor, procurement_officer) bypass per-warehouse scope checks — they can act on all warehouses in their tenant without rows in `user_warehouse_assignments`.

---

## API endpoints

All endpoints are under `/api/v1/iam`. Permission gates:

| Operation | Required permission |
|---|---|
| Read (list users, get user, list roles) | `iam.user.read` |
| Assign/revoke roles | `iam.user_role.assign` |
| Assign/revoke warehouses | `warehouse.assign_user` |

### User endpoints

```
GET  /iam/users                    List users in caller's tenant
GET  /iam/users/{user_id}          Single user detail
GET  /iam/roles                    All roles (for picker UI)
```

`GET /iam/users` accepts `?include_deleted=true` to include soft-deleted users (for audit). By default they are excluded.

Response shape for each user:

```json
{
  "id": "keycloak-sub",
  "email": "alice@example.com",
  "username": "alice",
  "deleted_at": null,
  "roles": [
    { "id": "...", "slug": "warehouse_manager", "name": "Warehouse Manager" }
  ],
  "warehouse_assignments": [
    {
      "warehouse_id": "...",
      "warehouse_name": "Nairobi Central",
      "assigned_at": "2026-07-24T10:00:00Z"
    }
  ],
  "has_global_warehouse_access": false
}
```

`has_global_warehouse_access: true` means the user holds `warehouse.global` — the admin UI shows "Global access — bypasses assignment list" instead of the (possibly empty) warehouse list.

### Role assignment

```
POST   /iam/users/{user_id}/roles        Assign a role
DELETE /iam/users/{user_id}/roles/{slug} Revoke a role
```

Request body for assign:

```json
{ "role_slug": "warehouse_manager" }
```

### Warehouse assignment

```
POST   /iam/users/{user_id}/warehouses              Assign a warehouse
DELETE /iam/users/{user_id}/warehouses/{warehouse_id} Revoke
```

Request body for assign:

```json
{ "warehouse_id": "uuid-of-warehouse" }
```

---

## The five required checks

Every mutating operation enforces these before writing to the DB:

### 1. Cross-tenant validation

Assigning a role or warehouse to a `user_id` who is not in `user_tenants` for the caller's tenant returns **403**:

```json
{ "detail": "cross-tenant access denied: user not in this tenant" }
```

Assigning a warehouse whose `tenant_id` differs from the caller's tenant returns **403**:

```json
{ "detail": "cross-tenant access denied: warehouse belongs to a different tenant" }
```

### 2. Self-lockout protection

Before revoking a role that carries `iam.user_role.assign`, the service counts how many other users in the tenant still hold that permission. If the count is zero, the request is rejected with **403**:

```json
{
  "detail": "cannot remove the last user able to manage roles in this tenant; assign IAM role management to another user first"
}
```

This prevents a permanent lockout where no one in the tenant can manage roles (which would require a manual DB fix to recover).

### 3. Soft-deleted user guard

Assigning a role or warehouse to a user whose `deleted_at` is not null returns **409**:

```json
{ "detail": "user <id> is soft-deleted and cannot receive new assignments" }
```

### 4. `warehouse.global` display

Users who hold `warehouse.global` have `has_global_warehouse_access: true` in the API response. The admin UI renders a "Global access — bypasses assignment list" badge instead of showing an empty (confusing) warehouse list. The `warehouse.assign_user` modal is also hidden for these users — assigning specific warehouses to a global user is pointless.

### 5. Audit logging

Every assign/revoke (role or warehouse) writes a row to `access_decisions`:

```
user_id     = target user
permission_id = iam.user_role.assign  (role ops) or warehouse.assign_user (warehouse ops)
decision    = "allow"
source      = "iam_service.assign_role" (or revoke_role, assign_warehouse, revoke_warehouse)
action_context = "actor=<sub> tenant=<tenant_id>"
created_by  = actor's sub
```

---

## Frontend admin UI

Route: `/admin/users`

Required: `iam.user.read` to view. Assign/revoke controls only render if the current user holds the relevant write permission — a read-only observer sees the state without getting disabled buttons everywhere.

### Layout

Each user card shows:
- Email + username, deleted badge if applicable
- **Roles**: chips with `×` revoke button. "Assign role" button opens a modal with a picker pre-filtered to roles the user doesn't already have.
- **Warehouse assignments**: list with timestamps and "Revoke" links. "Assign warehouse" button opens a picker pre-filtered to unassigned warehouses. If `has_global_warehouse_access` is true, a "Global access" badge replaces both the list and the assign button.

### Error handling

Self-lockout and cross-tenant errors from the API surface as inline error messages inside the modal — not as silent failures or generic toasts. The error text from the API `detail` field is shown verbatim.

---

## Migrations

| Migration | Change |
|---|---|
| 0002 | `user_roles` table created |
| 0004 | `tenant_id` added to `user_roles`; `user_warehouse_assignments` created |
| 0005 | `assigned_at` added to `user_warehouse_assignments`; `iam.user.read` permission seeded |
| 0006 | `iam_admin` role renamed to `tenant_admin`; `warehouse.create` + `warehouse.assign_user` added to `tenant_admin` |
