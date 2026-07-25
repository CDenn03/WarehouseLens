/**
 * GET /api/auth/logout
 *
 * RP-initiated logout (RFC 7009 / OIDC Session Management):
 *   1. Read id_token from the current session (server-side — never exposed to JS).
 *   2. Clear the NextAuth session cookie by calling the NextAuth signout endpoint.
 *   3. Redirect to Keycloak's end-session endpoint with id_token_hint so the
 *      Keycloak SSO session is also terminated.
 *
 * Without step 3 the user's Keycloak session remains alive.  On the next visit,
 * Keycloak would silently re-authenticate them via SSO without prompting for
 * credentials — which is not real logout behavior.
 *
 * The Keycloak end-session URL is:
 *   {issuer}/protocol/openid-connect/logout
 *     ?id_token_hint={id_token}
 *     &post_logout_redirect_uri={NEXTAUTH_URL}/signin
 *
 * Flow:
 *   Browser → GET /api/auth/logout
 *           → server clears NextAuth cookie (via signOut path)
 *           → 302 to Keycloak end-session
 *           → Keycloak clears its session
 *           → 302 to /signin (post_logout_redirect_uri)
 */

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  // Build the post-logout destination — always /signin on the same origin.
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const postLogoutUri = `${baseUrl}/signin`;

  // Build the Keycloak end-session URL.
  const issuer = process.env.KEYCLOAK_ISSUER!;
  const endSessionUrl = new URL(
    `${issuer}/protocol/openid-connect/logout`,
  );
  endSessionUrl.searchParams.set("post_logout_redirect_uri", postLogoutUri);
  endSessionUrl.searchParams.set("client_id", process.env.KEYCLOAK_CLIENT_ID!);

  // Add id_token_hint when available — this ties the logout to the exact
  // Keycloak session and is required by some realm configurations.
  const idToken = (session as unknown as Record<string, unknown>)
    ?.idToken as string | undefined;
  if (idToken) {
    endSessionUrl.searchParams.set("id_token_hint", idToken);
  }

  // Clear the NextAuth session cookie.  We do this by redirecting through
  // NextAuth's own signout POST, which is the only reliable way to get it
  // to clear the HttpOnly cookie.  We encode our Keycloak end-session URL
  // as the callbackUrl so the user lands there after cookie deletion.
  //
  // NextAuth signout via GET with callbackUrl:
  //   POST /api/auth/signout sets the cookie to expired and 302s to callbackUrl
  // We drive it via a direct response that clears the cookie ourselves and
  // redirects to Keycloak — this avoids a CSRFtoken round-trip from a GET handler.
  //
  // Approach: set the session cookie to expired (max-age=0) on the response,
  // then redirect to Keycloak end-session.  NextAuth sets cookies as HttpOnly
  // so we must match the exact cookie name it uses.
  const response = NextResponse.redirect(endSessionUrl.toString());

  // Clear both cookie variants NextAuth uses (HTTP vs HTTPS).
  const cookieBase = {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
  };
  response.cookies.set("next-auth.session-token", "", cookieBase);
  response.cookies.set("__Secure-next-auth.session-token", "", {
    ...cookieBase,
    secure: true,
  });
  // Also clear the CSRF cookie so state is fully reset.
  response.cookies.set("next-auth.csrf-token", "", { ...cookieBase, httpOnly: false });
  response.cookies.set("__Host-next-auth.csrf-token", "", {
    ...cookieBase,
    httpOnly: false,
    secure: true,
  });

  return response;
}
