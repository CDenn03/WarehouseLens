"""Correlation-ID middleware.

Reads ``X-Request-ID`` from the incoming request header (set by the Next.js BFF).
If absent, generates a UUID. Stores it in a ``contextvars.ContextVar`` so any
layer of the application can read it and attach it to log records.

Header forwarded to every downstream log line via ``get_request_id()``.
"""

import uuid
from contextvars import ContextVar

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

_request_id_var: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    """Return the current correlation ID (empty string if no request context)."""
    return _request_id_var.get()


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        _request_id_var.set(rid)

        response = await call_next(request)
        response.headers["x-request-id"] = rid
        return response
