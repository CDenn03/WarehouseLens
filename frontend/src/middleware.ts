import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ?? `req-${crypto.randomUUID()}`;
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
