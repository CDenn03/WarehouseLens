# Auth — BFF Pattern with HTTP-Only Cookies

Companion to the [Developer Implementation Guide](./developer-guide.md), Section 9. This document covers the Backend-for-Frontend (BFF) authentication architecture, Keycloak integration, cookie configuration, and Swagger UI setup.

## 1. Architecture

```
┌──────────────────────┐
│   Browser / Swagger  │  Sends HTTP-only cookie automatically
│   (localhost:3000)   │  on every request to the backend
└──────────┬───────────┘
           │  Cookie: access_token=<jwt>
           ▼
┌──────────────────────┐
│   FastAPI Backend    │  Reads JWT from cookie, validates
│   (BFF)              │  against Keycloak JWKS, extracts
│   localhost:8000     │  user + roles → CurrentUser
└──────────┬───────────┘
           │  JWKS fetch / token introspection
           ▼
┌──────────────────────┐
│   Keycloak           │  Issues JWTs, manages users + roles
│   localhost:8080     │  Realm: warehouselens
└──────────────────────┘
```

The backend acts as a BFF: it handles the OAuth2 login flow, stores the JWT in a secure cookie, and validates it on every request. The browser never sees the raw JWT — it only knows about the cookie.

## 2. Login Flow

### Step 1 — User navigates to Swagger UI

Open `/docs` in the browser. If not authenticated, the user sees the API but gets 401 on protected endpoints.

### Step 2 — BFF login redirect

`GET /api/v1/auth/login` redirects the browser to Keycloak's authorization endpoint:

```
https://keycloak:8080/realms/warehouselens/protocol/openid-connect/auth?
  client_id=warehouselens-backend
  &redirect_uri=http://localhost:8000/api/v1/auth/callback
  &response_type=code
  &scope=openid profile email
  &state=<csrf-token>
```

The `state` parameter is a random token stored in a short-lived signed cookie for CSRF protection.

### Step 3 — Keycloak authentication

The user authenticates in Keycloak (username/password, or any configured IdP). Keycloak redirects back to the callback URL with an authorization code:

```
http://localhost:8000/api/v1/auth/callback?code=<auth-code>&state=<csrf-token>
```

### Step 4 — Token exchange

The backend validates the `state` parameter against the CSRF cookie, then exchanges the authorization code for tokens by POSTing to Keycloak's token endpoint:

```
POST https://keycloak:8080/realms/warehouselens/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<auth-code>
&redirect_uri=http://localhost:8000/api/v1/auth/callback
&client_id=warehouselens-backend
&client_secret=<secret>
```

Keycloak returns:

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "id_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Step 5 — Set HTTP-only cookie

The backend stores the `access_token` JWT in an HTTP-only cookie and redirects to `/docs`:

```
Set-Cookie: access_token=<jwt>; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600
```

### Step 6 — Subsequent requests

Every request from the browser now includes the cookie automatically. The `get_current_user` dependency reads the JWT from the cookie, validates it, and resolves the `CurrentUser`.

## 3. Cookie Specification

| Attribute | Value | Rationale |
|---|---|---|
| **Name** | `access_token` | Clear, conventional |
| **Value** | Keycloak JWT (RS256 signed) | The access token from the token exchange |
| **HttpOnly** | `true` | Not accessible via JavaScript — prevents XSS token theft |
| **Secure** | `false` (dev) / `true` (prod) | HTTP in local dev, HTTPS in production |
| **SameSite** | `Lax` | Allows top-level navigation (Keycloak redirect back) while CSRF-protecting cross-site API calls |
| **Path** | `/` | Sent on all routes |
| **Max-Age** | `3600` | Matches typical JWT expiry; cookie expires when the token does |

### Environment variables

```env
# In .env (backend)
KEYCLOAK_CLIENT_SECRET=your-confidential-client-secret
COOKIE_NAME=access_token
COOKIE_DOMAIN=             # empty = same host only
COOKIE_SECURE=false        # true in production
COOKIE_SAMESITE=lax
COOKIE_MAX_AGE=3600
```

## 4. Swagger UI Configuration

FastAPI's built-in Swagger UI needs two settings to work seamlessly with the BFF cookie pattern:

```python
# app/main.py
app = FastAPI(
    title="WarehouseLens",
    version="0.1.0",
    swagger_ui_parameters={
        "withCredentials": True,      # Swagger sends cookies with requests
        "persistAuthorization": True,  # Authorize state survives page reloads
    },
)
```

### How it works in practice

1. Open `/docs` in the browser
2. Click the **Authorize** padlock button (optional — for manual Bearer token testing)
3. Navigate to `GET /api/v1/auth/login` and execute it — this redirects through Keycloak and sets the cookie
4. Return to `/docs` — all protected endpoints now work because the browser sends the cookie
5. Click **Try it out** on any endpoint and execute — the cookie is attached automatically

The `withCredentials` flag tells Swagger UI's underlying `fetch` / `XMLHttpRequest` to include cookies in cross-origin requests. Since Swagger runs on the same origin as the backend (`localhost:8000`), this is same-origin and the cookie is always sent — but the flag ensures it works even if the origins differ during development.

### Why HTTPBearer stays in the OpenAPI schema

The OpenAPI security scheme remains `HTTPBearer` because:

1. OpenAPI 3.1 has no native "cookie" security scheme that Swagger UI renders as a padlock
2. The `HTTPBearer` scheme lets developers paste a raw JWT for quick testing (useful during development before the full BFF flow is wired up)
3. In production, the cookie takes precedence — `get_current_user` reads from the cookie first, ignoring any `Authorization` header

The generated OpenAPI schema:

```json
{
  "components": {
    "securitySchemes": {
      "HTTPBearer": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  }
}
```

All protected routes include `security: [{"HTTPBearer": []}]`.

## 5. JWT Validation

When the backend receives a request with a JWT (from cookie or Bearer header), it validates the token against Keycloak's JWKS (JSON Web Key Set).

### JWKS fetch and cache

```python
# Pseudocode — see security.py for implementation
JWKS_CACHE: dict[str, dict] = {}  # kid → jwk
JWKS_CACHE_KEY = "keycloak:jwks"
JWKS_CACHE_TTL = 3600  # 1 hour

async def get_signing_key(token: str) -> RSAKey:
    # 1. Decode JWT header (unverified) to get kid
    header = jwt.get_unverified_header(token)
    kid = header["kid"]

    # 2. Check in-memory cache
    if kid in JWKS_CACHE:
        return JWKS_CACHE[kid]

    # 3. Fetch from Keycloak
    jwks_url = f"{KEYCLOAK_ISSUER_URL}/protocol/openid-connect/certs"
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url)
        for jwk in resp.json()["keys"]:
            JWKS_CACHE[jwk["kid"]] = jwk

    return JWKS_CACHE[kid]
```

### Validation steps

1. **Signature** — Verify RS256 signature using the public key from JWKS
2. **Issuer** — `iss` claim must equal `KEYCLOAK_ISSUER_URL`
3. **Audience** — `aud` claim must contain `KEYCLOAK_CLIENT_ID`
4. **Expiry** — `exp` claim must be in the future
5. **Not before** — `nbf` claim must be in the past (if present)

### Role extraction

Keycloak stores realm roles in the `realm_access.roles` claim:

```json
{
  "sub": "a1b2c3d4-...",
  "preferred_username": "john.doe",
  "realm_access": {
    "roles": ["admin", "warehouse_manager"]
  }
}
```

The backend maps these to the `ROLE_*` constants in `security.py`:

| Keycloak realm role | Constant | Scope |
|---|---|---|
| `admin` | `ROLE_ADMIN` | Global — all warehouses |
| `warehouse_manager` | `ROLE_WAREHOUSE_MANAGER` | Scoped to `user_warehouse_assignments` |
| `procurement_officer` | `ROLE_PROCUREMENT_OFFICER` | Scoped to `user_warehouse_assignments` |
| `auditor` | `ROLE_AUDITOR` | Global — read-only, all warehouses |

## 6. Auth Resolution Order

`get_current_user` checks three sources in order, returning as soon as one succeeds:

```
1. X-Debug-User header  → (tests / local dev) parse "sub:username:role1|role2"
2. access_token cookie  → (BFF pattern) extract JWT, validate, return
3. Authorization header  → (Swagger fallback) extract Bearer token, validate, return
4. None                 → hardcoded admin (scaffold, to be replaced with 401)
```

### Why this order?

- **`X-Debug-User` first** — tests send this header and don't have a valid JWT. It must win over any cookie or header that might be present in the test client.
- **Cookie second** — the BFF pattern is the primary auth mechanism in production. The browser sends the cookie automatically; no manual action needed.
- **Bearer header third** — Swagger's padlock lets developers paste tokens manually. This is a fallback for when the full BFF login flow isn't set up yet.
- **Hardcoded admin last** — scaffold fallback. To be replaced with `raise HTTPException(status_code=401)` once Keycloak is live.

## 7. Keycloak Realm Setup

### Clients

| Client ID | Type | Purpose |
|---|---|---|
| `warehouselens-backend` | bearer-only | The API validates tokens issued by Keycloak. Does not initiate login. |
| `warehouselens-frontend` | public | The Next.js frontend. Authorization Code + PKCE flow for user login. |

**Note:** For the BFF pattern, the backend client needs to be **confidential** (not bearer-only) because it initiates the authorization code flow and exchanges codes for tokens using the client secret. If using a separate BFF service, create a third client:

| Client ID | Type | Purpose |
|---|---|---|
| `warehouselens-bff` | confidential | BFF login flow — exchanges auth codes for tokens |

### Realm roles

Create four roles in the `warehouselens` realm:

- `admin` — full access, all warehouses
- `warehouse_manager` — read/write within assigned warehouses
- `procurement_officer` — read/write within assigned warehouses
- `auditor` — read-only, all warehouses

### Redirect URIs

For local development, add these to the backend client's **Valid Redirect URIs**:

```
http://localhost:8000/api/v1/auth/callback
http://localhost:3000/*
```

And to **Web Origins**:

```
http://localhost:3000
http://localhost:8000
```

## 8. CORS Configuration

The existing CORS middleware allows `http://localhost:3000` with credentials:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

For the BFF cookie pattern:
- **Swagger** runs on `localhost:8000` (same origin as backend) — no CORS issues, cookies are same-origin
- **Frontend** runs on `localhost:3000` — already configured in CORS, credentials work
- **Production** — the frontend is the only public service; backend is on Railway's private network, so CORS only needs the frontend's domain

**Important:** `allow_origins` cannot use wildcards (`*`) when `allow_credentials=True`. Each origin must be explicit.

## 9. Logout Flow

`GET /api/v1/auth/logout` does two things:

1. **Clears the cookie** — `Set-Cookie: access_token=; Max-Age=0; Path=/`
2. **Redirects to Keycloak logout** (optional) — for full SSO logout:

```
https://keycloak:8080/realms/warehouselens/protocol/openid-connect/logout?
  client_id=warehouselens-backend
  &post_logout_redirect_uri=http://localhost:8000/docs
```

## 10. Testing

### Unit / integration tests (existing)

Tests continue to use `X-Debug-User` headers — no changes needed:

```python
# tests/conftest.py
ADMIN = {"X-Debug-User": "sub-admin:admin:admin"}
AUDITOR = {"X-Debug-User": "sub-auditor:auditor:auditor"}
NAIROBI_MANAGER = {"X-Debug-User": "sub-nai-mgr:nai.manager:warehouse_manager"}
```

### End-to-end (manual)

1. Start the stack: `docker compose up`
2. Open `http://localhost:8000/docs`
3. Navigate to `GET /api/v1/auth/login` and execute — completes the Keycloak redirect flow
4. Return to `/docs` — the cookie is set
5. Call any protected endpoint — the cookie is sent automatically, auth succeeds

### Swagger padlock (manual token testing)

1. Get a JWT from Keycloak (e.g., via `GET /auth/login` or Keycloak's token endpoint directly)
2. Click the **Authorize** padlock in Swagger
3. Paste the JWT into the Bearer token field
4. Click **Authorize**
5. Execute any endpoint — the `Authorization: Bearer <token>` header is sent

The backend checks the cookie first, then the Bearer header. Both paths lead to the same JWT validation logic.

## 11. Security Considerations

| Concern | Mitigation |
|---|---|
| **XSS** | HttpOnly cookie — JS cannot read the JWT |
| **CSRF** | SameSite=Lax — cross-site requests don't send the cookie; top-level GETs do (safe because they don't mutate state). POST/PUT/PATCH from cross-origin won't include the cookie. |
| **Token theft via logs** | JWT is in an HttpOnly cookie, never logged by the backend |
| **Token expiry** | Cookie Max-Age matches JWT exp; implement refresh token rotation for long sessions |
| **Keycloak JWKS rotation** | Cache JWKS with a TTL; refetch on unknown `kid` |
| **Client secret exposure** | Store in environment variables, never in code or `.env` committed to git |
