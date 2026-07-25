/**
 * GET /api/auth/logout
 *
 * RP-initiated logout (OIDC Session Management):
 *   1. Clear the NextAuth session cookie.
 *   2. Redirect to Keycloak's end-session endpoint with id_token_hint so the
 *      Keycloak SSO session is also terminated.
 *   3. Keycloak redirects back to /signin (post_logout_redirect_uri must be
 *      registered in the Keycloak client config).
 *
 * If no id_token is available (e.g. session expired), we skip the Keycloak
 * end-session round-trip and redirect directly to /signin — the NextAuth
 * cookie is still cleared so the user is logged out of this app.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

/** Cookie name prefixes NextAuth may use for session/CSRF state. */
const AUTH_COOKIE_PREFIXES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
];

/**
 * Expire every NextAuth cookie present on the request.
 *
 * The session JWT holds access + refresh + id tokens, which pushes it past the
 * 4 KB cookie limit, so NextAuth splits it into chunks named
 * `next-auth.session-token.0`, `.1`, … Clearing only the unchunked name leaves
 * the real session intact, so match on prefix and clear whatever is actually
 * there.
 */
function clearCookies(request: NextRequest, response: NextResponse) {
  const cookieBase = {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
  };

  const names = new Set(AUTH_COOKIE_PREFIXES);
  for (const cookie of request.cookies.getAll()) {
    if (AUTH_COOKIE_PREFIXES.some((p) => cookie.name === p || cookie.name.startsWith(`${p}.`))) {
      names.add(cookie.name);
    }
  }

  for (const name of Array.from(names)) {
    response.cookies.set(name, "", {
      ...cookieBase,
      httpOnly: !name.includes("csrf-token"),
      secure: name.startsWith("__Secure-") || name.startsWith("__Host-"),
    });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  const baseUrl =
    process.env.NEXTAUTH_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const postLogoutUri = `${baseUrl}/signin`;

  const idToken = (session as unknown as Record<string, unknown>)
    ?.idToken as string | undefined;

  // If we have an id_token, perform full RP-initiated logout via Keycloak.
  // Without id_token_hint, Keycloak won't redirect back — just clear cookies
  // and redirect to /signin directly.
  if (idToken) {
    const issuer = process.env.KEYCLOAK_ISSUER!;
    const endSessionUrl = new URL(
      `${issuer}/protocol/openid-connect/logout`,
    );
    endSessionUrl.searchParams.set("id_token_hint", idToken);
    endSessionUrl.searchParams.set("post_logout_redirect_uri", postLogoutUri);

    const response = NextResponse.redirect(endSessionUrl.toString());
    return clearCookies(request, response);
  }

  // Fallback: no id_token — clear cookies and go to /signin.  Uses baseUrl,
  // not request.url: the dev server binds 0.0.0.0, so request.url would send
  // the browser to http://0.0.0.0:3000/signin.
  const response = NextResponse.redirect(postLogoutUri);
  return clearCookies(request, response);
}
