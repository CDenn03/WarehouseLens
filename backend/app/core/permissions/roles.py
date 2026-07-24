"""Role → permission-set definitions.

Each role's permission set is composed from named constants so a typo
fails at import time instead of silently granting/deny the wrong thing.
"""

from . import ALL_PERMISSIONS
from .agent import AGENT_INVOKE
from .dashboard import DASHBOARD_READ
from .forecast import FORECAST_READ
from .iam import IAM_ROLE_MANAGE, IAM_USER_ROLE_ASSIGN
from .inventory import INVENTORY_PRODUCT_CREATE, INVENTORY_READ, INVENTORY_WRITE
from .outbound import (
    OUTBOUND_PICK_LIST_MANAGE,
    OUTBOUND_SALES_ORDER_CREATE,
    OUTBOUND_SHIP_MANAGE,
    OUTBOUND_TRANSFER_CREATE,
)
from .procurement import (
    PROCUREMENT_ORDER_CREATE,
    PROCUREMENT_ORDER_RECEIVE,
    PROCUREMENT_SUPPLIER_CREATE,
)
from .warehouse import WAREHOUSE_GLOBAL

ROLE_DEFINITIONS: dict[str, set[str]] = {
    # Admin gets all permissions *except* IAM (IAM is managed by iam_admin).
    "admin": set(ALL_PERMISSIONS) - {IAM_ROLE_MANAGE, IAM_USER_ROLE_ASSIGN},
    # Warehouse Manager: inventory + outbound + dashboard + forecast + agent.
    "warehouse_manager": {
        INVENTORY_READ,
        INVENTORY_WRITE,
        INVENTORY_PRODUCT_CREATE,
        OUTBOUND_SALES_ORDER_CREATE,
        OUTBOUND_TRANSFER_CREATE,
        OUTBOUND_PICK_LIST_MANAGE,
        OUTBOUND_SHIP_MANAGE,
        DASHBOARD_READ,
        FORECAST_READ,
        AGENT_INVOKE,
    },
    # Procurement Officer: procurement + inventory.read + inventory.product.create + warehouse.global + dashboard + forecast + agent.
    "procurement_officer": {
        PROCUREMENT_SUPPLIER_CREATE,
        PROCUREMENT_ORDER_CREATE,
        PROCUREMENT_ORDER_RECEIVE,
        INVENTORY_READ,
        INVENTORY_PRODUCT_CREATE,
        WAREHOUSE_GLOBAL,
        DASHBOARD_READ,
        FORECAST_READ,
        AGENT_INVOKE,
    },
    # Auditor: read-only + warehouse.global.
    "auditor": {INVENTORY_READ, DASHBOARD_READ, FORECAST_READ, WAREHOUSE_GLOBAL},
    # IAM Admin: tenant IAM only.
    "iam_admin": {IAM_ROLE_MANAGE, IAM_USER_ROLE_ASSIGN},
}

# ── Derived constants for migration seeds ──────────────────────────────

# Maps role slug → role display name.
ROLE_NAMES: dict[str, str] = {
    "admin": "Administrator",
    "warehouse_manager": "Warehouse Manager",
    "procurement_officer": "Procurement Officer",
    "auditor": "Auditor",
    "iam_admin": "Tenant IAM Admin",
}
