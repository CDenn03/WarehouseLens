"""Keycloak Admin API client — provisions the accounts WarehouseLens hands out.

Tenant admins and platform admins are created here, not by hand in the Keycloak
console: creating a tenant creates its first user.  Every account is issued the
configured ``initial_admin_password`` as a **temporary** credential together with
the ``UPDATE_PASSWORD`` required action, so Keycloak forces a password change on
the first login and the shared bootstrap password never survives it.

Configuration lives in ``Settings`` (``KEYCLOAK_ADMIN_*``).  The admin base URL
and realm are derived from the issuer URL when not set explicitly, so a standard
deployment only needs credentials.  Anything that goes wrong upstream — missing
config, network failure, non-2xx response — surfaces as ``UpstreamError`` (502)
rather than a bare 500, because the caller's request was fine and the identity
provider is what failed.
"""
from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass

import httpx

from app.core.config import Settings, get_settings
from app.core.exceptions import UpstreamError

logger = logging.getLogger(__name__)

# Keycloak required action that shows the "Update password" screen at login.
UPDATE_PASSWORD = "UPDATE_PASSWORD"

_TIMEOUT = 10.0


@dataclass(frozen=True)
class KeycloakUser:
    """The subset of a Keycloak user record WarehouseLens mirrors.

    ``id`` is the ``sub`` claim the JWT will carry, which is also the primary
    key of the local ``users`` table — provisioning here means the user row can
    be written before the person has ever logged in.
    """

    id: str
    email: str
    username: str
    enabled: bool = True


@dataclass(frozen=True)
class ProvisionResult:
    """Outcome of ``provision_user``.

    ``created`` is False when the email already had a Keycloak account, in which
    case no password was touched and ``temporary_password`` is None — reusing an
    existing identity must never reset a working credential.
    """

    user: KeycloakUser
    created: bool
    temporary_password: str | None


# ── Configuration ──────────────────────────────────────────────────────────


def _split_issuer(issuer: str) -> tuple[str, str]:
    """Split ``http://host/realms/<realm>`` into (base_url, realm)."""
    base, _, realm = issuer.partition("/realms/")
    return base.rstrip("/"), realm.strip("/")


def _base_and_realm(settings: Settings) -> tuple[str, str]:
    issuer = settings.keycloak_internal_url or settings.keycloak_issuer_url
    derived_base, derived_realm = _split_issuer(issuer)
    base = (settings.keycloak_admin_url or derived_base).rstrip("/")
    realm = settings.keycloak_realm or derived_realm
    return base, realm


def _has_credentials(settings: Settings) -> bool:
    return bool(
        settings.keycloak_admin_client_secret
        or (settings.keycloak_admin_username and settings.keycloak_admin_password)
    )


def is_configured() -> bool:
    """True when provisioning calls can be attempted."""
    settings = get_settings()
    base, realm = _base_and_realm(settings)
    return bool(base and realm and _has_credentials(settings))


def initial_password() -> str:
    return get_settings().initial_admin_password


# ── Session ────────────────────────────────────────────────────────────────


def _fetch_token(client: httpx.Client, settings: Settings, base: str) -> str:
    """Obtain an admin access token.

    Prefers a service-account client (``client_credentials``) and falls back to
    the password grant used by the ``admin-cli`` bootstrap account.
    """
    if settings.keycloak_admin_client_secret:
        form = {
            "grant_type": "client_credentials",
            "client_id": settings.keycloak_admin_client_id,
            "client_secret": settings.keycloak_admin_client_secret,
        }
    else:
        form = {
            "grant_type": "password",
            "client_id": settings.keycloak_admin_client_id,
            "username": settings.keycloak_admin_username,
            "password": settings.keycloak_admin_password,
        }

    url = (
        f"{base}/realms/{settings.keycloak_admin_auth_realm}"
        "/protocol/openid-connect/token"
    )
    try:
        resp = client.post(url, data=form)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise UpstreamError(
            f"Keycloak rejected the admin credentials ({exc.response.status_code})"
        ) from exc
    except httpx.HTTPError as exc:
        raise UpstreamError(f"Could not reach Keycloak at {base}: {exc}") from exc

    return resp.json()["access_token"]


@contextmanager
def _admin() -> Iterator[tuple[httpx.Client, str]]:
    """Yield an authenticated client and the realm-scoped admin URL prefix."""
    settings = get_settings()
    base, realm = _base_and_realm(settings)
    if not base or not realm:
        raise UpstreamError(
            "Keycloak admin API is not configured — set KEYCLOAK_ADMIN_URL "
            "and KEYCLOAK_REALM"
        )
    if not _has_credentials(settings):
        raise UpstreamError(
            "Keycloak admin credentials are not configured — set "
            "KEYCLOAK_ADMIN_USERNAME/KEYCLOAK_ADMIN_PASSWORD or "
            "KEYCLOAK_ADMIN_CLIENT_SECRET"
        )

    with httpx.Client(timeout=_TIMEOUT) as client:
        token = _fetch_token(client, settings, base)
        client.headers["Authorization"] = f"Bearer {token}"
        yield client, f"{base}/admin/realms/{realm}"


def _send(
    client: httpx.Client,
    method: str,
    url: str,
    *,
    json: dict | None = None,
    what: str,
) -> httpx.Response:
    """Issue an admin request, translating transport/status failures."""
    try:
        resp = client.request(method, url, json=json)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip()
        raise UpstreamError(
            f"Keycloak {what} failed ({exc.response.status_code}): {detail[:200]}"
        ) from exc
    except httpx.HTTPError as exc:
        raise UpstreamError(f"Keycloak {what} failed: {exc}") from exc
    return resp


def _to_user(payload: dict) -> KeycloakUser:
    return KeycloakUser(
        id=payload["id"],
        email=payload.get("email") or "",
        username=payload.get("username") or "",
        enabled=payload.get("enabled", True),
    )


# ── Operations ─────────────────────────────────────────────────────────────


def _find_user_by_email(
    client: httpx.Client, admin_url: str, email: str
) -> KeycloakUser | None:
    """Email lookup on an already-authenticated client.  Keycloak's search can
    return near-matches, so the result is filtered here rather than trusted."""
    query = httpx.QueryParams({"email": email, "exact": "true"})
    resp = _send(client, "GET", f"{admin_url}/users?{query}", what="user lookup")
    for row in resp.json():
        if (row.get("email") or "").lower() == email.lower():
            return _to_user(row)
    return None


def find_user_by_email(email: str) -> KeycloakUser | None:
    """Exact (case-insensitive) email lookup."""
    with _admin() as (client, admin_url):
        return _find_user_by_email(client, admin_url, email)


def provision_user(email: str, username: str | None = None) -> ProvisionResult:
    """Ensure a Keycloak account exists for ``email``.

    A new account is created with the configured temporary password and the
    UPDATE_PASSWORD required action.  An account that already exists is returned
    untouched — its owner keeps whatever password they already set.
    """
    password = initial_password()

    with _admin() as (client, admin_url):
        existing = _find_user_by_email(client, admin_url, email)
        if existing is not None:
            return ProvisionResult(user=existing, created=False, temporary_password=None)

        _send(
            client,
            "POST",
            f"{admin_url}/users",
            json={
                "username": username or email.split("@")[0],
                "email": email,
                # No SMTP in most deployments: a provisioned admin must be able
                # to sign in immediately, and their email is vouched for by the
                # platform admin who typed it.
                "emailVerified": True,
                "enabled": True,
                "requiredActions": [UPDATE_PASSWORD],
                "credentials": [
                    {"type": "password", "value": password, "temporary": True}
                ],
            },
            what="user creation",
        )

        created = _find_user_by_email(client, admin_url, email)
        if created is None:
            raise UpstreamError(
                f"Keycloak accepted the account for {email} but it could not be read back"
            )

    logger.info("provisioned Keycloak user %s (%s)", created.id, email)
    return ProvisionResult(user=created, created=True, temporary_password=password)


def reset_password(user_id: str) -> str:
    """Reset a user to the shared temporary password and force a change at the
    next login.  Returns the password so the caller can relay it."""
    password = initial_password()
    with _admin() as (client, admin_url):
        _send(
            client,
            "PUT",
            f"{admin_url}/users/{user_id}/reset-password",
            json={"type": "password", "value": password, "temporary": True},
            what="password reset",
        )
        # `temporary: true` already schedules UPDATE_PASSWORD; setting it
        # explicitly keeps the behaviour independent of realm configuration.
        _send(
            client,
            "PUT",
            f"{admin_url}/users/{user_id}",
            json={"requiredActions": [UPDATE_PASSWORD]},
            what="required-action update",
        )
    logger.info("reset password for Keycloak user %s", user_id)
    return password


def update_user(
    user_id: str,
    *,
    email: str | None = None,
    username: str | None = None,
    enabled: bool | None = None,
) -> None:
    """Patch mutable fields on a Keycloak account."""
    body: dict = {}
    if email is not None:
        body["email"] = email
        body["emailVerified"] = True
    if username is not None:
        body["username"] = username
    if enabled is not None:
        body["enabled"] = enabled
    if not body:
        return

    with _admin() as (client, admin_url):
        _send(client, "PUT", f"{admin_url}/users/{user_id}", json=body, what="user update")


def set_enabled(user_id: str, enabled: bool) -> None:
    """Enable or disable sign-in for an account.  Preferred over deletion:
    disabled accounts keep their ``sub``, so audit references still resolve."""
    update_user(user_id, enabled=enabled)
