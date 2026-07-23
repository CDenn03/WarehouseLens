/**
 * Shared server-side API client.
 *
 * Every feature `services/` module goes through `apiFetch` so cross-cutting
 * concerns (base URL, JSON handling, error normalization and — eventually —
 * auth headers) live in exactly one place.
 *
 * The browser only talks to localhost:3000. Next.js rewrites proxy
 * /api/v1/* to FastAPI at localhost:8000 (see next.config.js).
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
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const url = new URL(`/api/v1${path}`, window.location.origin);
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
