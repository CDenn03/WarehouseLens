from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import router as v1_router
from app.core.exceptions import WarehouseLensError

app = FastAPI(title="WarehouseLens", version="0.1.0")

# Local dev: the frontend calls the backend from the browser on a different port.
# Deployed, calls go over Railway's private network (RAILWAY.md), so this list
# never needs a production origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)


@app.exception_handler(WarehouseLensError)
async def domain_error_handler(_request: Request, exc: WarehouseLensError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
