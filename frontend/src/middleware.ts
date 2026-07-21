import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * AUTH MIDDLEWARE SCAFFOLD — currently a pass-through.
 *
 * TODO(learning): this is where route protection goes once Keycloak works.
 * The real implementation would:
 *
 *   1. Read the session cookie (`request.cookies.get(...)`). Middleware runs
 *      on the Edge runtime, so use a library that works there (e.g. `jose`
 *      for JWT verification) — Node-only crypto libraries will not load.
 *   2. If there is NO valid session and the path is not public
 *      (e.g. /api/auth/*, static assets), redirect to the login route:
 *        return NextResponse.redirect(new URL('/api/auth/login', request.url))
 *      and carry the originally requested URL along (query param or cookie)
 *      so the user lands back where they intended after login.
 *   3. If there IS a session, optionally enforce coarse ROLE gates by prefix:
 *        /procurement -> admin | procurement_officer
 *        /inventory   -> admin | warehouse_manager | auditor
 *      Keep this coarse: middleware sees only the token, not the data. Fine-
 *      grained checks (e.g. "may this user touch warehouse X?") belong in the
 *      backend, which re-validates the JWT on every request anyway. The UI
 *      hiding a button is UX, not security.
 *   4. Do NOT refresh tokens here on every request — middleware runs on every
 *      matched navigation and asset fetch; refresh belongs in getAccessToken()
 *      where backend calls actually need a live token.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Skip Next.js internals and static files; everything else flows through.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
