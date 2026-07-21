/**
 * =============================================================================
 * AUTH SCAFFOLD — INTENTIONALLY NOT IMPLEMENTED
 * =============================================================================
 * This project exists (in part) so its owner can learn Keycloak. This module
 * defines the SHAPE a real Keycloak OIDC integration would have, returns a
 * hardcoded fake session so the app runs, and documents — via TODO(learning)
 * comments — what each real piece does, where it goes, and what the genuine
 * design decisions are. Nothing here performs authentication.
 *
 * TODO(learning): LIBRARY CHOICE — three realistic options, pick ONE later:
 *
 *   1. next-auth (Auth.js) with the built-in Keycloak provider.
 *      + Handles the whole OIDC dance (redirect, code exchange, cookie
 *        session, refresh) with ~30 lines of config in a route handler at
 *        app/api/auth/[...nextauth]/route.ts.
 *      + Best fit for the App Router / server components model used here.
 *      - Abstracts away exactly the protocol details you're trying to learn;
 *        token refresh with Keycloak requires a custom `jwt` callback anyway.
 *
 *   2. keycloak-js (the official browser adapter).
 *      + Made by the Keycloak team; handles login/refresh in the browser.
 *      - Client-side only: tokens live in JS memory/storage (XSS-exposed),
 *        and server components / server actions can't see the session, which
 *        fights the architecture of this app. Better suited to pure SPAs.
 *
 *   3. Hand-rolled OIDC (openid-client or plain fetch) + your own middleware.
 *      + You implement discovery, the auth redirect, the code-for-token
 *        exchange, cookie sessions and refresh yourself — maximum learning.
 *      - Most code, easiest to get subtly wrong (state/nonce/PKCE validation,
 *        clock skew, refresh races). Great second pass after option 1 works.
 *
 * TODO(learning): CLIENT TYPE — Authorization Code + PKCE vs confidential client:
 *   - PUBLIC client + PKCE: no client secret; PKCE (a per-login random
 *     `code_verifier` whose hash is sent up front) proves the same party that
 *     started the login is finishing it. Required when the exchange happens
 *     in a browser. Works server-side too.
 *   - CONFIDENTIAL client: Next.js has a real server, so it CAN keep a
 *     `client_secret` and authenticate itself during the code exchange.
 *     Stronger, and what you'd normally pick for this app. Best practice
 *     today: confidential client AND PKCE together.
 *   Either way the flow is Authorization Code — never implicit (deprecated),
 *   never password grant (bypasses Keycloak's login page, MFA, etc.).
 */

export type Role =
  | "admin"
  | "warehouse_manager"
  | "procurement_officer"
  | "auditor";

export interface SessionUser {
  /** Keycloak's stable subject identifier (the `sub` claim of the ID token). */
  sub: string;
  /** Display name (`name` claim, or `preferred_username` as a fallback). */
  name: string;
  /**
   * TODO(learning): roles come from the access token JWT. Keycloak puts realm
   * roles in `realm_access.roles` and client roles in
   * `resource_access.<client-id>.roles`. Decode the token (it's just three
   * base64url segments), verify the signature against the realm's JWKS, then
   * map those claims into this array. Prefer client roles — they keep this
   * app's role names out of the global realm namespace.
   */
  roles: Role[];
  /**
   * TODO(learning): warehouse scoping is NOT a built-in Keycloak concept.
   * Model it as a custom user attribute (e.g. `warehouse_ids`) plus a
   * protocol mapper on the client that copies the attribute into a custom
   * JWT claim. Extract that claim here. The backend must enforce it too —
   * this array only drives what the UI shows.
   */
  assignedWarehouseIds: string[];
}

export interface Session {
  user: SessionUser;
  /** ISO timestamp after which the session should be considered stale. */
  expiresAt: string;
}

/**
 * Returns the current session.
 *
 * TODO(learning): the real implementation reads the session from an httpOnly
 * cookie set during login (see `login()` below):
 *   1. Read the cookie via `cookies()` from `next/headers`.
 *   2. Either the cookie IS an encrypted JWT session (stateless — what
 *      next-auth does), or it's an opaque session id pointing at a
 *      server-side store (Redis/DB) that holds the tokens (stateful).
 *   3. Validate expiry; if the access token is expired but the refresh token
 *      isn't, refresh transparently (see `getAccessToken`).
 *   4. Return `null` when there is no valid session — callers must handle it.
 *
 * TODO(learning): WHERE TO STORE TOKENS — the decision that matters most:
 *   - httpOnly, Secure, SameSite=Lax cookie: JS can't read it, so XSS can't
 *     exfiltrate tokens. The right default for a Next.js app. Keep the cookie
 *     under ~4KB: store the refresh token + a session id server-side and put
 *     only minimal identity in the cookie if tokens are large.
 *   - localStorage / in-memory (the keycloak-js model): readable by any
 *     injected script. Only acceptable for pure SPAs, and even then risky.
 *   - Never put tokens in non-httpOnly cookies or URL fragments you persist.
 *
 * HARDCODED for now so the app runs without Keycloak.
 */
export async function getSession(): Promise<Session> {
  return {
    user: {
      sub: "fake-sub-0000-dev-user",
      name: "Brian Koton",
      roles: ["admin"],
      assignedWarehouseIds: [],
    },
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Starts the login flow.
 *
 * TODO(learning): a real implementation redirects the browser to Keycloak's
 * authorization endpoint:
 *
 *   {KEYCLOAK_ISSUER}/protocol/openid-connect/auth
 *     ?client_id=warehouselens-frontend
 *     &response_type=code
 *     &scope=openid profile email
 *     &redirect_uri=https://app.example.com/api/auth/callback
 *     &state=<random>            // CSRF protection — verify on callback
 *     &nonce=<random>            // binds the ID token to this request
 *     &code_challenge=<S256(code_verifier)>   // PKCE
 *     &code_challenge_method=S256
 *
 * Keycloak shows its own login page (this is a feature: passwords never touch
 * this app), then redirects back to `redirect_uri` with `?code=...&state=...`.
 * The callback route handler must then:
 *   1. Verify `state` matches what was stored (in a short-lived cookie).
 *   2. POST the code to {ISSUER}/protocol/openid-connect/token with
 *      grant_type=authorization_code, redirect_uri, code_verifier (PKCE),
 *      and client_secret if this is a confidential client.
 *   3. Receive { access_token, id_token, refresh_token, expires_in }.
 *   4. Validate the ID token (issuer, audience, nonce, signature via JWKS).
 *   5. Create the session cookie (see getSession notes) and redirect to the
 *      page the user originally wanted (carry it through `state` or a cookie).
 */
export async function login(): Promise<void> {
  // Scaffold only — no-op. See TODO(learning) above.
}

/**
 * Ends the session.
 *
 * TODO(learning): logging out has TWO halves, and forgetting the second is a
 * classic bug:
 *   1. Local: delete the session cookie / server-side session entry.
 *   2. Keycloak: redirect to {ISSUER}/protocol/openid-connect/logout
 *      (with `id_token_hint` and `post_logout_redirect_uri`) so Keycloak's own
 *      SSO cookie dies too. Skip this and the next `login()` silently signs
 *      the user straight back in — confusing on shared warehouse terminals.
 */
export async function logout(): Promise<void> {
  // Scaffold only — no-op. See TODO(learning) above.
}

/**
 * Returns a valid access token for calling the backend, or null.
 *
 * TODO(learning): the real implementation:
 *   1. Load tokens from the session (cookie or server-side store).
 *   2. If the access token has >30s of life left, return it.
 *   3. Otherwise POST to {ISSUER}/protocol/openid-connect/token with
 *      grant_type=refresh_token — Keycloak access tokens are short-lived
 *      (5 min by default) BY DESIGN; refresh is the normal path, not the
 *      exception. Store the rotated refresh token it returns.
 *   4. If refresh fails (refresh token expired/revoked, session idle timeout),
 *      clear the session and force a fresh login.
 *   Watch out for concurrent server components refreshing simultaneously —
 *   dedupe in-flight refreshes per session or you'll hit Keycloak's
 *   refresh-token-reuse detection.
 *
 * Consumed by `apiFetch` in '@/lib/api.ts' (see the TODO there). Returns null
 * for now, so no Authorization header is sent.
 */
export async function getAccessToken(): Promise<string | null> {
  return null;
}

/** Convenience guard the UI can use to show/hide role-gated controls. */
export function hasRole(session: Session, role: Role): boolean {
  return session.user.roles.includes(role) || session.user.roles.includes("admin");
}
