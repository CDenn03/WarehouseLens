/**
 * Automatic access-token refresh via Keycloak's token endpoint.
 *
 * Called from the Auth.js JWT callback when the access token is expired
 * or about to expire (within 60 seconds).
 *
 * Includes a single-flight lock: if multiple parallel requests trigger a
 * refresh for the same session, only one hits Keycloak; the others wait
 * on the same in-flight Promise.  This prevents the race condition where
 * parallel widget requests near the 5-minute token boundary each attempt
 * a refresh, consume the one-time refresh token, and cause random logouts.
 */

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * In-flight refresh Promises keyed by the refresh token.
 * While a refresh is in progress, subsequent requests for the same token
 * await the existing Promise instead of firing a duplicate request.
 */
const inflight = new Map<string, Promise<RefreshResult>>();

export async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResult> {
  // If a refresh for this exact token is already in flight, reuse it.
  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const promise = doRefresh(refreshToken);

  // Store before awaiting so concurrent callers see it immediately.
  inflight.set(refreshToken, promise);

  try {
    return await promise;
  } finally {
    // Always clean up — success or failure.
    inflight.delete(refreshToken);
  }
}

async function doRefresh(refreshToken: string): Promise<RefreshResult> {
  const issuer = process.env.KEYCLOAK_ISSUER!;
  const clientId = process.env.KEYCLOAK_CLIENT_ID!;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET!;

  // Keycloak token endpoint is derived from the issuer URL.
  const tokenEndpoint = issuer.replace(/\/realms\/.+/, "")
    + "/realms/"
    + issuer.split("/realms/")[1]
    + "/protocol/openid-connect/token";

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const resp = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Refresh failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  return {
    accessToken: data.access_token as string,
    // Keycloak may or may not rotate refresh tokens — use the new one if present.
    refreshToken: (data.refresh_token as string) ?? refreshToken,
    // `expires_in` is seconds from now; convert to Unix timestamp.
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in as number),
  };
}
