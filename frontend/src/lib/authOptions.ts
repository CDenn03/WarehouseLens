import type { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { refreshAccessToken } from "@/lib/tokenRefresh";

const REFRESH_THRESHOLD_SECONDS = 60;

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // ── Initial sign-in: persist all tokens ──────────────────────────
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          // id_token is required for Keycloak RP-initiated logout
          // (end-session endpoint expects id_token_hint).
          idToken: account.id_token,
          expiresAt:
            Math.floor(Date.now() / 1000) + Number(account.expires_in ?? 300),
        };
      }

      // ── Subsequent requests: check expiry and refresh if needed ──────
      const expiresAt = (token.expiresAt as number) ?? 0;
      const now = Math.floor(Date.now() / 1000);

      if (expiresAt - now > REFRESH_THRESHOLD_SECONDS) {
        // Token is still valid — return as-is.
        return token;
      }

      // Token is expired or about to expire — attempt refresh.
      const rt = token.refreshToken as string | undefined;
      if (!rt) {
        // No refresh token available — force re-authentication.
        return { ...token, accessToken: undefined, expiresAt: 0 };
      }

      try {
        const refreshed = await refreshAccessToken(rt);
        return {
          ...token,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
          // id_token does not change on refresh — keep the original.
        };
      } catch {
        // Refresh failed — invalidate session, force re-login.
        return {
          ...token,
          accessToken: undefined,
          refreshToken: undefined,
          expiresAt: 0,
        };
      }
    },

    async session({ session, token }) {
      // Expose access token and id token for server-side use only
      // (BFF proxy and logout endpoint). Neither reaches browser JS.
      (session as unknown as Record<string, unknown>).accessToken =
        token.accessToken as string;
      (session as unknown as Record<string, unknown>).idToken =
        token.idToken as string | undefined;
      return session;
    },
  },
};
