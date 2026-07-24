import logging
import sys
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import router as v1_router
from app.core.correlation import CorrelationIDMiddleware, get_request_id
from app.core.exceptions import WarehouseLensError

# Structured logging: every record includes the correlation ID.
class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id() or "-"
        return True

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(
    logging.Formatter("%(asctime)s %(levelname)s [%(request_id)s] %(message)s")
)
handler.addFilter(ContextFilter())
root = logging.getLogger()
root.handlers.clear()
root.addHandler(handler)
root.setLevel(logging.INFO)

logger = logging.getLogger(__name__)

app = FastAPI(title="WarehouseLens", version="0.1.0")

app.add_middleware(CorrelationIDMiddleware)

# BFF proxy handles same-origin — CORS only needed for Swagger UI in dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.exception_handler(WarehouseLensError)
async def domain_error_handler(request: Request, exc: WarehouseLensError) -> JSONResponse:
    duration_ms = round((time.time() - float(request.state.start_time)) * 1000) \
        if hasattr(request.state, "start_time") else 0
    logger.info(
        "request completed",
        extra={
            "request_id": get_request_id(),
            "user_id": request.headers.get("x-debug-user", "unknown"),
            "status": exc.status_code,
            "duration_ms": duration_ms,
        },
    )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
