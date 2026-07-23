import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const BACKEND_URL = process.env.API_URL ?? "http://localhost:8000";

const UPSTREAM_ERROR = {
  error: "upstream_unavailable",
  message: "API service is unreachable",
} as const;

function generateRequestId(): string {
  return `req-${crypto.randomUUID()}`;
}

async function proxy(
  method: string,
  path: string,
  request: NextRequest,
): Promise<NextResponse> {
  // ── 1. Resolve session ──────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const accessToken = (session as unknown as Record<string, unknown>).accessToken as
    | string
    | undefined;
  if (!accessToken) {
    console.error(
      JSON.stringify({
        request_id: request.headers.get("x-request-id") ?? "unknown",
        layer: "bff",
        error: "missing_access_token",
        user_sub: session.user?.sub ?? "unknown",
      }),
    );
    return NextResponse.json(
      { error: "unauthorized", message: "No access token in session" },
      { status: 401 },
    );
  }

  // ── 2. Correlation ID ───────────────────────────────────────────────
  const requestId =
    request.headers.get("x-request-id") ?? generateRequestId();

  // ── 3. Build upstream request ───────────────────────────────────────
  const upstreamUrl = new URL(`/api/v1${path}`, BACKEND_URL);
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("X-Request-ID", requestId);

  // Forward safe request headers (skip hop-by-hop headers).
  const forwardsafe = [
    "accept",
    "accept-language",
    "content-type",
    "if-none-match",
  ];
  for (const h of forwardsafe) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }

  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
  };

  // Forward body for non-GET/HEAD methods.
  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
    // @ts-expect-error duplex is needed for streaming body passthrough
    init.duplex = "half";
  }

  console.log(
    JSON.stringify({
      request_id: requestId,
      layer: "bff",
      method,
      path: `/api/v1${path}`,
      user_sub: session.user?.sub ?? "unknown",
    }),
  );

  // ── 4. Proxy to FastAPI ─────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), init);
  } catch (err) {
    console.error(
      JSON.stringify({
        request_id: requestId,
        layer: "bff",
        error: "upstream_connect_failed",
        detail: String(err),
      }),
    );
    return NextResponse.json(UPSTREAM_ERROR, { status: 502 });
  }

  // ── 5. Return transparently ─────────────────────────────────────────
  const responseHeaders = new Headers();
  const copyHeaders = ["content-type", "x-request-id", "etag"];
  for (const h of copyHeaders) {
    const v = upstream.headers.get(h);
    if (v) responseHeaders.set(h, v);
  }
  responseHeaders.set("x-request-id", requestId);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy("GET", path.join("/"), req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy("POST", path.join("/"), req);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy("PUT", path.join("/"), req);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy("PATCH", path.join("/"), req);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy("DELETE", path.join("/"), req);
}
