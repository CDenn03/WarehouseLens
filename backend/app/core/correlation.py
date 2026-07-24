"""Correlation-ID middleware.

Reads ``X-Request-ID`` from the incoming request header (set by the Next.js BFF).
If absent, generates a UUID. Stores it in a ``contextvars.ContextVar`` so any
layer of the application can read it and attach it to log records.

Also records request start time to compute duration_ms for observability logs.
"""

import time
import uuid
from contextvars import ContextVar

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

_request_id_var: ContextVar[str] = ContextVar("request_id", default="")
_start_time_var: ContextVar[float] = ContextVar("request_start_time", default=0.0)


def get_request_id() -> str:
    """Return the current correlation ID (empty string if no request context)."""
    return _request_id_var.get()


def get_start_time() -> float:
    """Return the request start time (0.0 if no request context)."""
    return _start_time_var.get()


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())
        _request_id_var.set(rid)
        _start_time_var.set(time.time())

        response = await call_next(request)
        response.headers["x-request-id"] = rid

        # Attach duration to response header for observability (useful for
        # upstream metrics even if the caller doesn't log it).
        duration_ms = round((time.time() - _start_time_var.get()) * 1000)
        response.headers["x-duration-ms"] = str(duration_ms)

        return response
