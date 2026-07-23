/**
 * =============================================================================
 * AUTH — KEYCLOAK OIDC via NextAuth (Auth.js)
 * =============================================================================
 * The browser authenticates through Keycloak. NextAuth stores an HttpOnly
 * session cookie. The BFF proxy route (src/app/api/v1/[...path]/route.ts)
 * extracts the access token server-side and forwards it to FastAPI.
 *
 * Authorization is DB-driven: FastAPI resolves permissions from PostgreSQL.
 * The JWT carries only identity (sub, preferred_username).
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export interface Session {
  user: {
    sub: string;
    name: string;
  };
  expiresAt: string;
}

/**
 * Returns the current session (server-side only).
 */
export async function getSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return {
    user: {
      sub: session.user.sub,
      name: session.user.name ?? "",
    },
    expiresAt: session.expires ?? "",
  };
}
