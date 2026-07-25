from fastapi import APIRouter

from app.api.v1 import (
    agent,
    auth,
    dashboard,
    forecast,
    iam,
    inventory,
    outbound,
    platform,
    procurement,
    warehouses,
)

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(warehouses.router)
router.include_router(inventory.router)
router.include_router(procurement.router)
router.include_router(outbound.router)
router.include_router(dashboard.router)
router.include_router(agent.router)
router.include_router(forecast.router)
router.include_router(iam.router)
router.include_router(platform.router)
