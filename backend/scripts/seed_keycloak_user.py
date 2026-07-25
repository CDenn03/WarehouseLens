"""Idempotent script: Keycloak bootstrap — realm, clients, user, audience scope.

Creates the warehouselens realm, frontend/backend clients, the platform admin
user, and the audience scope.  Safe to run repeatedly on every container start.

Usage:
    # From the backend directory:
    python -m scripts.seed_keycloak_user
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

KC_URL = os.environ.get("KC_URL", "http://localhost:8080")
KC_REALM = os.environ.get("KC_REALM", "warehouselens")
KC_ADMIN = os.environ.get("KC_ADMIN", "admin")
KC_ADMIN_PASSWORD = os.environ.get("KC_ADMIN_PASSWORD", "admin")
KC_USER_EMAIL = os.environ.get("KC_USER_EMAIL", "platform@warehouselens.local")
KC_USER_PASSWORD = os.environ.get("KC_USER_PASSWORD", "Changeme1")
KC_FRONTEND_CLIENT = os.environ.get("KC_FRONTEND_CLIENT", "warehouselens-frontend")
KC_FRONTEND_CLIENT_SECRET = os.environ.get("KC_FRONTEND_CLIENT_SECRET", "yC1dkxIWi81IdJAtOPkbAihXeZGaqby2")
KC_BACKEND_AUDIENCE = os.environ.get("KC_BACKEND_AUDIENCE", "warehouselens-backend")


def _admin_token() -> str:
    """Get an admin access token from Keycloak."""
    data = urllib.parse.urlencode({
        "grant_type": "password",
        "client_id": "admin-cli",
        "username": KC_ADMIN,
        "password": KC_ADMIN_PASSWORD,
    }).encode()
    req = urllib.request.Request(
        f"{KC_URL}/realms/master/protocol/openid-connect/token",
        data=data,
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["access_token"]


def _ensure_realm(token: str) -> None:
    """Create the realm if it doesn't exist."""
    req = urllib.request.Request(
        f"{KC_URL}/admin/realms/{KC_REALM}",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        urllib.request.urlopen(req)
        print(f"Realm '{KC_REALM}' already exists.")
        return
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise

    body = json.dumps({
        "realm": KC_REALM,
        "enabled": True,
        "displayName": "WarehouseLens",
        "sslRequired": "none",
        "registrationAllowed": False,
        "loginWithEmailAllowed": True,
        "duplicateEmailsAllowed": False,
        "resetPasswordAllowed": True,
        "editUsernameAllowed": False,
        "bruteForceProtected": False,
        "permanentLockout": False,
        "maxFailureWaitSeconds": 900,
        "minimumQuickLoginWaitSeconds": 60,
        "waitIncrementSeconds": 60,
        "quickLoginCheckMilliSeconds": 1000,
        "maxDeltaTimeSeconds": 43200,
        "failureFactor": 5,
        "passwordPolicy": "length(8) and upperCase(1) and lowerCase(1) and digits(1)",
        "smtpServer": {},
        "ssoSessionIdleTimeout": 1800,
        "ssoSessionMaxLifespan": 36000,
        "accessTokenLifespan": 300,
        "accessTokenLifespanForImplicitFlow": 900,
        "offlineSessionIdleTimeout": 2592000,
        "offlineSessionMaxLifespan": 604800,
        "accessCodeLifespan": 60,
        "accessCodeLifespanUserAction": 300,
        "accessCodeLifespanLogin": 1800,
        "actionTokenGeneratedByAdminLifespan": 43200,
        "actionTokenGeneratedByUserLifespan": 300,
    }).encode()
    req = urllib.request.Request(
        f"{KC_URL}/admin/realms",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    urllib.request.urlopen(req)
    print(f"Created realm '{KC_REALM}'.")


def _ensure_client(
    token: str,
    client_id: str,
    *,
    client_secret: str | None = None,
    public: bool = False,
    bearer_only: bool = False,
    standard_flow: bool = True,
    direct_access: bool = False,
    redirect_uris: list[str] | None = None,
    web_origins: list[str] | None = None,
) -> None:
    """Create a Keycloak client if it doesn't exist."""
    existing = _find_client(token, client_id)
    if existing:
        print(f"Client '{client_id}' already exists (id={existing}).")
        return

    body: dict = {
        "clientId": client_id,
        "enabled": True,
        "publicClient": public,
        "bearerOnly": bearer_only,
        "standardFlowEnabled": standard_flow,
        "directAccessGrantsEnabled": direct_access,
        "serviceAccountsEnabled": False,
        "redirectUris": redirect_uris or [],
        "webOrigins": web_origins or [],
    }
    if client_secret and not public:
        body["secret"] = client_secret

    req = urllib.request.Request(
        f"{KC_URL}/admin/realms/{KC_REALM}/clients",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    urllib.request.urlopen(req)
    print(f"Created client '{client_id}'.")


def _find_user(token: str, email: str) -> str | None:
    """Return the Keycloak user ID if the user exists, else None."""
    req = urllib.request.Request(
        f"{KC_URL}/admin/realms/{KC_REALM}/users?email={email}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as resp:
        users = json.loads(resp.read())
    for u in users:
        if u.get("email", "").lower() == email.lower():
            return u["id"]
    return None


def _create_user(token: str, email: str) -> str:
    """Create a new user and return their ID."""
    body = json.dumps({
        "username": email.split("@")[0],
        "email": email,
        "emailVerified": True,
        "enabled": True,
    }).encode()
    req = urllib.request.Request(
        f"{KC_URL}/admin/realms/{KC_REALM}/users",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    urllib.request.urlopen(req)

    # Fetch the newly created user ID.
    return _find_user(token, email)


def _set_password(token: str, user_id: str, password: str) -> None:
    """Set the user's password (non-temporary)."""
    body = json.dumps({
        "type": "password",
        "value": password,
        "temporary": False,
    }).encode()
    req = urllib.request.Request(
        f"{KC_URL}/admin/realms/{KC_REALM}/users/{user_id}/reset-password",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="PUT",
    )
    urllib.request.urlopen(req)


def _find_client(token: str, client_id: str) -> str | None:
    """Return the Keycloak internal UUID for a client, else None."""
    req = urllib.request.Request(
        f"{KC_URL}/admin/realms/{KC_REALM}/clients?clientId={client_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as resp:
        clients = json.loads(resp.read())
    for c in clients:
        if c.get("clientId") == client_id:
            return c["id"]
    return None


def _ensure_audience_scope(token: str) -> None:
    """Create a client scope with a hardcoded audience mapper pointing to the
    backend, and add it to the frontend client's default scopes.

    This makes the frontend JWT include `aud: [..., "warehouselens-backend"]`
    so the backend's _verify_token() accepts it.
    """
    scope_name = f"audience-{KC_BACKEND_AUDIENCE}"

    # 1. Check if the scope already exists.
    req = urllib.request.Request(
        f"{KC_URL}/admin/realms/{KC_REALM}/client-scopes",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as resp:
        scopes = json.loads(resp.read())
    existing = next((s for s in scopes if s["name"] == scope_name), None)

    if existing:
        scope_id = existing["id"]
        print(f"Client scope '{scope_name}' already exists (id={scope_id}).")
    else:
        # 2. Create the client scope.
        body = json.dumps({
            "name": scope_name,
            "description": f"Adds {KC_BACKEND_AUDIENCE} to the JWT audience",
            "protocol": "openid-connect",
            "attributes": {
                "include.in.token.scope": "false",
                "display.on.consent.screen": "false",
            },
        }).encode()
        req = urllib.request.Request(
            f"{KC_URL}/admin/realms/{KC_REALM}/client-scopes",
            data=body,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        urllib.request.urlopen(req)

        # Fetch the newly created scope ID.
        with urllib.request.urlopen(
            urllib.request.Request(
                f"{KC_URL}/admin/realms/{KC_REALM}/client-scopes",
                headers={"Authorization": f"Bearer {token}"},
            )
        ) as resp:
            scopes = json.loads(resp.read())
        scope_id = next(s["id"] for s in scopes if s["name"] == scope_name)
        print(f"Created client scope '{scope_name}' (id={scope_id}).")

    # 3. Add an audience mapper to the scope (idempotent).
    mappers_url = f"{KC_URL}/admin/realms/{KC_REALM}/client-scopes/{scope_id}/protocol-mappers/models"
    req = urllib.request.Request(
        mappers_url,
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as resp:
        mappers = json.loads(resp.read())
    has_audience = any(
        m.get("protocolMapper") == "oidc-audience-mapper"
        and m.get("config", {}).get("included.client.audience") == KC_BACKEND_AUDIENCE
        for m in mappers
    )
    if not has_audience:
        body = json.dumps({
            "name": f"audience-{KC_BACKEND_AUDIENCE}",
            "protocol": "openid-connect",
            "protocolMapper": "oidc-audience-mapper",
            "config": {
                "included.client.audience": KC_BACKEND_AUDIENCE,
                "id.token.claim": "false",
                "access.token.claim": "true",
                "userinfo.token.claim": "false",
            },
        }).encode()
        create_req = urllib.request.Request(
            mappers_url,
            data=body,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        urllib.request.urlopen(create_req)
        print(f"Added audience mapper for '{KC_BACKEND_AUDIENCE}'.")

    # 4. Assign the scope to the frontend client's default scopes.
    client_id = _find_client(token, KC_FRONTEND_CLIENT)
    if client_id is None:
        print(f"WARNING: client '{KC_FRONTEND_CLIENT}' not found — skipping scope assignment.")
        return

    # Use the dedicated endpoint to add a default client scope.
    req = urllib.request.Request(
        f"{KC_URL}/admin/realms/{KC_REALM}/clients/{client_id}/default-client-scopes/{scope_id}",
        headers={"Authorization": f"Bearer {token}"},
        method="PUT",
    )
    try:
        urllib.request.urlopen(req)
        print(f"Assigned scope '{scope_name}' to client '{KC_FRONTEND_CLIENT}'.")
    except urllib.error.HTTPError as e:
        if e.code == 409:
            print(f"Scope '{scope_name}' already assigned to '{KC_FRONTEND_CLIENT}'.")
        else:
            raise


def main() -> None:
    print(f"KC_URL={KC_URL}  realm={KC_REALM}  user={KC_USER_EMAIL}")

    token = _admin_token()

    # ── Realm bootstrap ─────────────────────────────────────────────────
    _ensure_realm(token)

    # ── Client bootstrap ────────────────────────────────────────────────
    _ensure_client(
        token,
        KC_FRONTEND_CLIENT,
        client_secret=KC_FRONTEND_CLIENT_SECRET,
        public=False,
        standard_flow=True,
        direct_access=False,
        redirect_uris=[
            "http://localhost:3000/api/auth/callback/keycloak",
        ],
        web_origins=["http://localhost:3000"],
    )
    _ensure_client(
        token,
        KC_BACKEND_AUDIENCE,
        public=False,
        bearer_only=True,
        standard_flow=False,
    )

    # ── User bootstrap ──────────────────────────────────────────────────
    user_id = _find_user(token, KC_USER_EMAIL)
    if user_id:
        print(f"User already exists (id={user_id}). Updating password.")
    else:
        user_id = _create_user(token, KC_USER_EMAIL)
        print(f"Created user (id={user_id}).")
    _set_password(token, user_id, KC_USER_PASSWORD)
    print(f"Password set for {KC_USER_EMAIL}.")

    # ── Audience scope bootstrap ────────────────────────────────────────
    _ensure_audience_scope(token)


if __name__ == "__main__":
    main()
