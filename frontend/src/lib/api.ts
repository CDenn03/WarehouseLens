/**
 * Shared server-side API client.
 *
 * Every feature `services/` module goes through `apiFetch` so cross-cutting
 * concerns (base URL, JSON handling, error normalization and — eventually —
 * auth headers) live in exactly one place.
 *
 * Two call paths, one function:
 *
 *   Browser  → /api/v1/* on the same origin. The BFF proxy route reads the
 *              HttpOnly session cookie and attaches the bearer token.
 *   Server   → FastAPI directly (API_URL), with the bearer token attached
 *              here. Server-side `fetch` has no cookie jar, so routing these
 *              calls back through the BFF would arrive unauthenticated and
 *              always 401.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Query params — `undefined`, `null` and empty strings are omitted. */
  query?: Record<string, QueryValue>;
  /** JSON-serializable request body. */
  body?: unknown;
  /** Next.js fetch cache mode. Defaults to `no-store`: operational data must be fresh. */
  cache?: RequestCache;
  /** Bearer token for server-side calls that bypass the session cookie. */
  token?: string;
}

const BACKEND_URL = process.env.API_URL ?? "http://localhost:8000";

/**
 * Server-side bearer token: use the explicit one when the caller has it,
 * otherwise fall back to the session so page/layout components don't each
 * have to thread the token through their service layer.
 */
async function resolveServerToken(
  explicit: string | undefined,
): Promise<string | undefined> {
  if (explicit) return explicit;
  const [{ getServerSession }, { authOptions }] = await Promise.all([
    import("next-auth"),
    import("@/lib/authOptions"),
  ]);
  const session = await getServerSession(authOptions);
  return (session as unknown as Record<string, unknown> | null)?.accessToken as
    | string
    | undefined;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const isServer = typeof window === "undefined";
  const baseUrl = isServer ? BACKEND_URL : window.location.origin;
  const url = new URL(`/api/v1${path}`, baseUrl);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (isServer) {
    const token = await resolveServerToken(options.token);
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } else if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: options.cache ?? "no-store",
      credentials: "same-origin",
    });
  } catch (error) {
    throw new ApiError(
      "Could not reach the WarehouseLens API. Is the backend running?",
      0,
      error,
    );
  }

  if (!response.ok) {
    let details: unknown;
    let message = `API request failed (${response.status} ${response.statusText})`;
    try {
      details = await response.json();
      if (
        details &&
        typeof details === "object" &&
        "detail" in details &&
        typeof (details as { detail: unknown }).detail === "string"
      ) {
        message = (details as { detail: string }).detail;
      }
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
