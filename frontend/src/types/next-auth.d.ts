import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    /** Keycloak ID token — used for end-session (logout) only. */
    idToken?: string;
    user: {
      sub: string;
      name: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** Keycloak ID token — needed for RP-initiated logout. */
    idToken?: string;
    expiresAt?: number;
  }
}
