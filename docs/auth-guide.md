# WarehouseLens Authentication & Authorization

## Architecture at a Glance

```
Browser                Next.js BFF              FastAPI               PostgreSQL
  │                        │                       │                      │
  │  1. Login via Keycloak │                       │                      │
  │◄──────────────────────►│                       │                      │
  │                        │                       │                      │
  │  2. Session cookie     │                       │                      │
  │  (HttpOnly, Secure)    │                       │                      │
  ├───────────────────────►│                       │                      │
  │                        │                       │                      │
  │  3. GET /api/v1/...    │                       │                      │
  ├───────────────────────►│                       │                      │
  │                        │  4. Read session      │                      │
  │                        │     Extract token     │                      │
  │                        │                       │                      │
  │                        │  5. Bearer + X-Req-ID │                      │
  │                        ├──────────────────────►│                      │
  │                        │                       │  6. Verify JWT       │
  │                        │                       │     via JWKS         │
  │                        │                       │                      │
  │                        │                       │  7. Resolve perms    │
  │                        │                       │     from DB          │
  │                        │                       ├─────────────────────►│
  │                        │                       │                      │
  │                        │  8. Response           │  9. Check perm      │
  │                        │◄──────────────────────┤     (deny default)   │
  │  10. Response          │                       │                      │
  │◄───────────────────────┤                       │                      │
```

There are **three trust boundaries**:

| Layer | What it knows | What it decides |
|-------|---------------|-----------------|
| **Keycloak** | Identity (who you are) | Issues JWT with `sub`, `preferred_username` |
| **Next.js BFF** | Session cookie validity | Whether to forward the request at all |
| **FastAPI** | JWT signature + DB permissions | Whether the user may perform the action |

---

## The Full Request Lifecycle

### Step 1 — Login (browser ↔ Keycloak)

The user clicks "Sign In" on the custom sign-in page (`src/app/(auth)/signin/page.tsx`), which calls `signIn("keycloak")` from `next-auth/react`. NextAuth fetches the OIDC discovery document from Keycloak, constructs the authorization URL, and redirects the browser to Keycloak. Keycloak authenticates the user (username/password, SSO, MFA — whatever is configured in the realm). On success, Keycloak redirects back to NextAuth's callback endpoint with an authorization code.

NextAuth exchanges the code for three tokens at Keycloak's token endpoint:

```
POST /realms/warehouselens/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<auth_code>
&client_id=warehouselens-frontend
&client_secret=<secret>
```

Keycloak responds with:

```json
{
  "access_token": "eyJhbGciOi...",      // short-lived (5 min default)
  "refresh_token": "eyJhbGciOi...",      // long-lived (30 min default)
  "expires_in": 300,
  "token_type": "Bearer"
}
```

### Step 2 — Session Creation (Auth.js)

Auth.js receives these tokens and triggers the `jwt` callback (`authOptions.ts:16`). On first sign-in, the `account` object is present, so all three values are persisted into the encrypted session JWT:

```typescript
// authOptions.ts — jwt callback (first sign-in)
if (account) {
  return {
    ...token,
    accessToken: account.access_token,    // Keycloak access token
    refreshToken: account.refresh_token,  // Keycloak refresh token
    expiresAt: Math.floor(Date.now() / 1000) + Number(account.expires_in ?? 300),
  };
}
```

Auth.js then encrypts this into an **HttpOnly, Secure, SameSite=Lax** cookie named `next-auth.session-token`. The browser stores this cookie. **The access token never touches JavaScript** — it lives only inside the encrypted cookie.

### Step 3 — Subsequent Requests (browser → BFF)

Every API request includes the session cookie automatically. The Next.js middleware (`middleware.ts`) runs first:

```
middleware.ts:
  1. Generate/propagate X-Request-ID
  2. Reject bodies > 10 MB (413)
  3. Rate-limit per IP (60/min authenticated, 20/min unauthenticated)
  4. Forward to the route handler
```

Then the BFF proxy route (`src/app/api/v1/[...path]/route.ts`) runs:

```
route.ts:
  1. getServerSession(authOptions) — decrypts cookie, returns session
  2. Extract accessToken from session
  3. Build upstream request with Authorization: Bearer <token>
  4. Forward to FastAPI with X-Request-ID
  5. Return response transparently
```

The critical line in the BFF proxy:

```typescript
// route.ts:58
headers.set("Authorization", `Bearer ${accessToken}`);
```

**The BFF never logs the access token.** It only logs the `user_sub` for observability.

### Step 4 — JWT Verification (FastAPI)

FastAPI's `get_current_user()` dependency (`security.py:126`) receives the `Authorization: Bearer` header and verifies the JWT:

```
get_current_user():
  1. Parse Authorization header
  2. Decode JWT header → extract `kid` (key ID)
  3. Look up `kid` in JWKS cache
  4. If cache miss or expired → fetch from Keycloak's /certs endpoint
  5. If `kid` still unknown after refresh → 401 (single retry, then fail closed)
  6. Verify signature (RS256), audience (warehouselens-backend), issuer
  7. Extract `sub` and `preferred_username` → return CurrentUser
```

The JWKS cache (`_JWKSCache`) has a **15-minute TTL**. After expiry, the next request triggers a fresh fetch from Keycloak:

```python
# security.py:100-104
async def _get_jwks() -> dict[str, dict]:
    if not _jwks_cache.is_valid:          # TTL expired?
        return await _fetch_jwks()         # re-fetch
    return _jwks_cache.keys               # use cached
```

### Step 5 — Permission Resolution (DB)

The JWT carries **only identity** (`sub`, `preferred_username`). It does **not** carry roles or permissions. This is by design.

When a route uses `require_permission("dashboard.read")`, the dependency chain runs:

```python
# security.py:179-217
def require_permission(permission: str):
    async def checker(user, db):
        # 1. Query PostgreSQL for this user's roles
        user.permissions = resolve_permissions(db, user.sub)

        # 2. Check if the required permission is in the set
        if permission not in user.permissions:
            raise ForbiddenError(...)    # 403

        return user
    return checker
```

`resolve_permissions()` (`permission_service.py:20-41`) does two queries:

```sql
-- Step 1: Which roles does this user have?
SELECT role_id FROM user_roles WHERE user_id = 'keycloak-sub-uuid';

-- Step 2: What permissions do those roles grant?
SELECT permission_id FROM role_permissions
WHERE role_id IN ('role-uuid-1', 'role-uuid-2');
```

Returns a `set[str]` like `{"inventory.read", "dashboard.read", "forecast.read"}`.

### Step 6 — Warehouse Scope (Data Isolation)

Some users have permission to *do* something (e.g., `inventory.write`) but only within *specific warehouses*. This is the two-layer auth model:

```
Layer 1: Capability  — "Can you write inventory at all?"     → require_permission()
Layer 2: Data scope  — "Which warehouses can you write to?"  → enforce_warehouse_scope()
```

```python
# security.py:238-248
def enforce_warehouse_scope(db, user, warehouse_id):
    _ensure_permissions(db, user)                    # lazy-load if empty
    if _GLOBAL_PERMISSIONS & user.permissions:       # warehouse.global → bypass
        return
    if warehouse_id not in assigned_warehouse_ids(db, user):
        raise ForbiddenError("not assigned to warehouse")
```

For list endpoints, `scope_filter_warehouse_ids()` returns either `None` (global access) or a `set[UUID]` of allowed warehouse IDs, which is used to filter the SQL query.

---

## Local Development Setup

### Keycloak Hostname

In local dev, Keycloak runs inside Docker but the browser runs on the host machine. The OIDC discovery document must advertise `localhost:8080` as the public hostname so the browser can reach Keycloak's authorization endpoint.

Keycloak is started with:

```yaml
# docker-compose.yml
keycloak:
  command: start-dev --hostname=http://localhost:8080 --hostname-strict=false
```

The `--hostname` flag controls what URLs Keycloak returns in its OIDC discovery document (`/.well-known/openid-configuration`). Without it, Keycloak advertises `http://keycloak:8080` (the Docker-internal hostname), which the browser cannot resolve.

### Frontend Container Networking

The frontend container needs to reach Keycloak at `localhost:8080` for token exchange (OIDC discovery + token endpoint calls). Since `localhost` inside a container refers to the container itself, we use Docker's `extra_hosts` to map `localhost` to the host gateway:

```yaml
# docker-compose.yml
frontend:
  extra_hosts:
    - "localhost:host-gateway"
```

This adds a `/etc/hosts` entry inside the container mapping `localhost` to the host's IP, allowing the Next.js server to reach Keycloak on the host.

### Environment Variables

```bash
# frontend/.env
KEYCLOAK_ISSUER=http://localhost:8080/realms/warehouselens
NEXTAUTH_URL=http://localhost:3000
```

`KEYCLOAK_ISSUER` uses `localhost:8080` (not `keycloak:8080`) because:
1. NextAuth uses this URL to fetch the OIDC discovery document (server-side, from the container)
2. The discovery document returns endpoint URLs based on this hostname
3. The browser navigates to these URLs, so they must be reachable from the host

### Keycloak Client Configuration

The `warehouselens-frontend` client must be configured in Keycloak with:

| Setting | Value |
|---------|-------|
| Client ID | `warehouselens-frontend` |
| Client Secret | (from `.env`) |
| Standard Flow Enabled | `true` |
| Direct Access Grants | `false` |
| Redirect URIs | `http://localhost:3000/api/auth/callback/keycloak` |
| Web Origins | `http://localhost:3000` |

**Note:** Keycloak runs in dev mode with ephemeral H2 storage. Realm and client configuration is lost on container restart. Recreate via the admin API or Keycloak console (`http://localhost:8080`).

### NextAuth Route Path

The NextAuth catch-all route **must** be at:

```
src/app/api/auth/[...nextauth]/route.ts    ← CORRECT
src/app/api/[...nextauth]/route.ts         ← WRONG (every endpoint returns 400)
```

This is because NextAuth parses the action from the catch-all segment: for `/api/auth/csrf`, the catch-all at `api/auth/` captures `['csrf']`, so `nextauth[0]` is `'csrf'`. If the route is at `api/`, the catch-all captures `['auth', 'csrf']`, making `nextauth[0]` = `'auth'` — an unknown action that falls through to the default error handler.

---

## The Permission Model (Database Schema)

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ permissions  │◄────│ role_permissions │────►│    roles     │
├──────────────┤     ├─────────────────┤     ├──────────────┤
│ id (PK)      │     │ role_id (FK)    │     │ id (PK)      │
│ description  │     │ permission_id   │     │ slug (UNQ)   │
│ category     │     │    (FK)         │     │ name         │
└──────────────┘     └─────────────────┘     └──────────────┘
                                                        │
                                                        │
                         ┌─────────────────┐            │
                         │    user_roles    │────────────┘
                         ├─────────────────┤
                         │ user_id (str)   │  ← Keycloak `sub`
                         │ role_id (FK)    │
                         │ assigned_at     │
                         └─────────────────┘
```

**Deny-by-default**: If a user has no role assignment, they have zero permissions. Every request is rejected with 403.

### The 16 Permissions

| Permission | Category | Description |
|-----------|----------|-------------|
| `warehouse.create` | warehouse | Create warehouses |
| `warehouse.assign_user` | warehouse | Assign users to warehouses |
| `warehouse.global` | warehouse | Bypass warehouse-scope checks (all warehouses) |
| `inventory.read` | inventory | View inventory |
| `inventory.write` | inventory | Create inventory transactions |
| `inventory.product.create` | inventory | Create products |
| `procurement.supplier.create` | procurement | Create suppliers |
| `procurement.order.create` | procurement | Create purchase orders |
| `procurement.order.receive` | procurement | Receive purchase orders |
| `outbound.sales_order.create` | outbound | Create sales orders |
| `outbound.transfer.create` | outbound | Create internal transfers |
| `outbound.pick_list.manage` | outbound | Generate and complete pick lists |
| `outbound.ship.manage` | outbound | Ship and deliver outbound requests |
| `dashboard.read` | dashboard | View dashboard |
| `forecast.read` | forecast | View forecasts |
| `agent.invoke` | agent | Invoke the AI agent |

### The 4 Roles

| Role | Permissions | warehouse.global? |
|------|-------------|-------------------|
| **admin** | All 16 | Yes |
| **warehouse_manager** | inventory + outbound + dashboard + forecast + agent | No |
| **procurement_officer** | procurement + inventory.read + inventory.product.create + dashboard + forecast + agent | No |
| **auditor** | inventory.read + dashboard.read + forecast.read | Yes (read-only global scope) |

---

## Token Refresh Algorithm

The Keycloak access token expires after 5 minutes. Auth.js handles this transparently:

```
jwt callback fires on every API route
  │
  ├── Is this a first sign-in? (account exists)
  │     YES → Store accessToken, refreshToken, expiresAt → return
  │
  ├── Is expiresAt - now > 60 seconds?
  │     YES → Token still valid → return as-is (no refresh needed)
  │
  ├── Is refreshToken available?
  │     NO  → Invalidate session (accessToken: undefined, expiresAt: 0)
  │           → User will be redirected to Keycloak login on next request
  │
  ├── Call refreshAccessToken(refreshToken)
  │     POST to Keycloak /protocol/openid-connect/token
  │     grant_type=refresh_token
  │
  ├── Success? → Store new accessToken, refreshToken, expiresAt → return
  │
  └── Failure? → Invalidate session → force re-login
```

The `refreshAccessToken()` function (`tokenRefresh.ts:14-53`):

```typescript
const body = new URLSearchParams({
  grant_type: "refresh_token",
  refresh_token: refreshToken,
  client_id: clientId,          // warehouselens-frontend
  client_secret: clientSecret,  // from env
});
```

Keycloak may rotate refresh tokens (issue a new one with each refresh). The code handles both cases:

```typescript
refreshToken: (data.refresh_token as string) ?? refreshToken,
// Use new refresh token if present, otherwise keep the old one
```

---

## JWT Verification Algorithm (Backend)

```
Token arrives at FastAPI
  │
  ├── Decode header (no verification needed for header)
  │   → Extract kid (Key ID)
  │
  ├── Is kid in JWKS cache?
  │   ├── Cache valid (< 15 min old)?
  │   │     YES → Use cached key
  │   │     NO  → Fetch fresh JWKS from Keycloak
  │   │           → Store in cache
  │   │           → Use new key
  │   │
  │   └── kid still unknown after refresh?
  │         → Refresh JWKS once (single retry)
  │         → If still unknown → 401 "Invalid token"
  │
  ├── Convert JWK → RSA public key
  │
  ├── Verify signature (RS256)
  │
  ├── Verify audience = "warehouselens-backend"
  │
  ├── Verify issuer = "http://localhost:8080/realms/warehouselens"
  │
  ├── Verify expiration (exp claim)
  │
  └── Extract claims:
        sub → Keycloak subject ID
        preferred_username → human-readable name
        (roles are IGNORED — permissions come from DB)
```

---

## Pitfalls to Avoid

### 1. Never Read Roles from the JWT

```python
# WRONG — roles from JWT are stale and bypass DB authorization
roles = payload.get("realm_access", {}).get("roles", [])

# CORRECT — permissions resolved from DB every request
user.permissions = resolve_permissions(db, user.sub)
```

Keycloak can have roles in the JWT (`realm_access.roles`), but we intentionally ignore them. The JWT is identity-only. This is the core architectural decision that makes revocation instant — removing a `user_roles` row immediately blocks access without waiting for token expiry.

### 2. Never Trust the `X-Debug-User` Header in Production

```python
# security.py:139-141
if x_debug_user:
    sub, username, _perms = x_debug_user.split(":", 2)
    return CurrentUser(sub=sub, username=username)
```

This header bypasses all JWT verification. In production, the middleware should strip this header before it reaches FastAPI. Currently it's accepted for testing convenience.

### 3. Don't Cache Permissions (Yet)

```python
# permission_service.py:1-10
# No caching per the architecture doc: add caching only after performance
# measurements show a bottleneck.
```

`resolve_permissions()` hits PostgreSQL on every `require_permission()` call. This is intentional — it keeps revocation instant and the code simple. Add Redis caching only after profiling shows it's needed.

### 4. Don't Return the Access Token to the Client

```typescript
// authOptions.ts:57-63
async session({ session, token }) {
  // Expose access token for the BFF proxy route (server-side only — never
  // reaches browser JS).
  (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
  return session;
}
```

The `accessToken` is in the session object, which is only available server-side (via `getServerSession()`). The browser never sees it. If you accidentally expose it in a client component, the token leaks to browser JS.

### 5. Don't Skip `enforce_warehouse_scope()` on Write Endpoints

```python
# CORRECT — both checks run
@router.post("/inventory/transactions")
def create_transaction(
    body: ...,
    user: CurrentUser = Depends(require_permission("inventory.write")),
):
    enforce_warehouse_scope(db, user, body.warehouse_id)  # Layer 2
```

`require_permission()` checks *capability*. `enforce_warehouse_scope()` checks *data access*. A warehouse manager with `inventory.write` must also be assigned to the specific warehouse.

### 6. The BFF Must Always Read the Session Server-Side

```typescript
// CORRECT — getServerSession reads the encrypted cookie
const session = await getServerSession(authOptions);

// WRONG — never use client-side session
const { data: session } = useSession(); // This runs in the browser
```

The BFF proxy route runs on the server. It reads the session cookie directly. Client-side session hooks (`useSession()`) are for UI rendering only — they never reach FastAPI.

### 7. Don't Forget `_ensure_permissions()` in Direct Dependencies

```python
# If you use get_current_user directly (not require_permission):
def some_endpoint(user: CurrentUser = Depends(get_current_user)):
    enforce_warehouse_scope(db, user, warehouse_id)  # permissions may be empty!
```

`get_current_user()` returns a `CurrentUser` with empty `permissions`. You must call `_ensure_permissions()` (or `require_permission()`) before checking permissions. `enforce_warehouse_scope()` calls `_ensure_permissions()` internally, but if you check `user.permissions` directly, it will be empty.

### 8. Handle the Refresh Token Expiry Gracefully

If the refresh token itself expires (Keycloak default: 30 minutes), the JWT callback returns `accessToken: undefined`. The next API request hits the BFF proxy, which finds no `accessToken` in the session and returns 401. The browser redirects to Keycloak login.

Don't try to "fix" this — it's correct behavior. The user must re-authenticate.

### 9. Correlation IDs Must Flow End-to-End

```
Browser → X-Request-ID → middleware.ts (generates if absent)
                       → route.ts (forwards)
                       → FastAPI CorrelationIDMiddleware (reads or generates)
                       → every log line includes request_id
```

If you add a new middleware or proxy layer, make sure it propagates `X-Request-ID`. Without it, you can't trace a request across services.

### 10. The `_GLOBAL_PERMISSIONS` Set Is Not a Role

```python
_GLOBAL_PERMISSIONS = {"warehouse.global"}

# This is a permission, not a role. Users with warehouse.global bypass
# warehouse scope checks. The auditor role has this permission, which
# means they can read data from all warehouses (but can't write).
```

### 11. The NextAuth Route Must Be Under `api/auth/`

```typescript
// CORRECT — src/app/api/auth/[...nextauth]/route.ts
// The catch-all captures ['csrf'], ['signin'], ['callback', 'keycloak'], etc.

// WRONG — src/app/api/[...nextauth]/route.ts
// The catch-all captures ['auth', 'csrf'] — nextauth[0] is 'auth', not 'csrf'.
// Every endpoint returns: "Error: This action with HTTP GET is not supported by NextAuth.js"
```

The file path matters because NextAuth uses `params.nextauth[0]` as the action identifier. Placing it one level too high silently breaks all NextAuth endpoints with a misleading error message.

---

## The `CurrentUser` Object

This is what flows through the entire backend:

```python
@dataclass
class CurrentUser:
    sub: str          # Keycloak UUID — stable, never changes
    username: str     # preferred_username — human-readable
    permissions: set[str]  # Resolved from DB by require_permission()
```

- `sub` is the primary key for all authorization lookups
- `username` is for logging and display only
- `permissions` starts empty, gets populated by `resolve_permissions()` when `require_permission()` runs
- `permissions` is **never** read from the JWT

---

## Observability: What Gets Logged

Every permission check emits a structured log:

```json
{
  "request_id": "req-abc123",
  "user_id": "keycloak-sub-uuid",
  "permission": "dashboard.read",
  "decision": "allow",
  "status": 200
}
```

Every BFF proxy request logs:

```json
{
  "request_id": "req-abc123",
  "layer": "bff",
  "method": "GET",
  "path": "/api/v1/dashboard/kpis",
  "user_sub": "keycloak-sub-uuid",
  "status": 200,
  "upstream_status": 200,
  "duration_ms": 47
}
```

Audit logging (`access_decisions` table) is only written for state-changing financial actions (e.g., `receive_purchase_order`), not for every read.

---

## Quick Reference: How to Add a New Protected Endpoint

```python
from app.core.security import (
    CurrentUser,
    enforce_warehouse_scope,
    require_permission,
)

@router.post("/my-new-endpoint")
def my_endpoint(
    body: MySchema,
    db: Session = Depends(get_db),
    # Layer 1: capability check
    user: CurrentUser = Depends(require_permission("my.permission.id")),
):
    # Layer 2: data scope check (if warehouse-specific)
    enforce_warehouse_scope(db, user, body.warehouse_id)

    # ... business logic ...
```

Then add the permission to the migration seed and grant it to the appropriate roles.
