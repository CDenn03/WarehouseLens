import { NextRequest, NextResponse } from "next/server";

// ── Per-user / per-IP rate-limit buckets ──────────────────────────────────
// In-memory store — acceptable for a single serverless instance.  Each bucket
// tracks {count, resetAt}.  Buckets reset every 60 s; the first request after
// reset starts a new window.
//
// Authenticated requests are keyed by the session cookie (per-user), so
// workers on the same IP don't share a quota.  Unauthenticated requests
// fall back to per-IP limiting.

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

const AUTH_LIMIT = 60;     // per minute, per user
const UNAUTH_LIMIT = 20;   // per minute, per IP
const WINDOW_MS = 60_000;  // 1-minute window

function cleanupBuckets(now: number) {
  // Evict stale entries on every request (cheap — only a few entries).
  if (buckets.size > 10_000) {
    const entries = Array.from(buckets.entries());
    for (const [key, bucket] of entries) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  }
}

function checkRateLimit(key: string, limit: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }

  cleanupBuckets(now);
  return { ok: true, retryAfter: 0 };
}

/**
 * Derive a stable per-user key from the NextAuth session cookie.
 * Falls back to a short SHA-256 to keep the bucket key small.
 */
async function sessionKey(cookie: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cookie));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(request: NextRequest) {
  // ── 1. Correlation ID ──────────────────────────────────────────────────
  const requestId =
    request.headers.get("x-request-id") ?? `req-${crypto.randomUUID()}`;

  // ── 2. Request size guard (10 MB) ──────────────────────────────────────
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "request_too_large", message: "Maximum request body size is 10 MB" },
      { status: 413 },
    );
  }

  // ── 3. Rate limiting ──────────────────────────────────────────────────
  const sessionCookie =
    request.cookies.get("next-auth.session-token")?.value ??
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  let rateKey: string;
  let limit: number;

  if (sessionCookie) {
    // Authenticated — per-user key derived from session cookie.
    rateKey = `u:${await sessionKey(sessionCookie)}`;
    limit = AUTH_LIMIT;
  } else {
    // Unauthenticated — per-IP.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    rateKey = `ip:${ip}`;
    limit = UNAUTH_LIMIT;
  }

  const { ok, retryAfter } = checkRateLimit(rateKey, limit);
  if (!ok) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", retry_after: retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // ── 4. Propagate correlation ID ────────────────────────────────────────
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
