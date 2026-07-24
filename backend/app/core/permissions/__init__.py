"""Central permission catalog — single source of truth for all permission
strings, descriptions, and categories in the system.

Each domain module defines its permissions as named constants and a
``PERMISSIONS`` dict.  This aggregator merges them, checks for collisions,
and derives each permission's category from its module name so category
and permission set can never silently drift apart.
"""

from . import (
    agent,
    dashboard,
    forecast,
    iam,
    inventory,
    outbound,
    procurement,
    warehouse,
)

_MODULES = [agent, dashboard, forecast, iam, inventory, outbound, procurement, warehouse]

ALL_PERMISSIONS: dict[str, str] = {}
PERMISSION_CATEGORY: dict[str, str] = {}

for _mod in _MODULES:
    _overlap = ALL_PERMISSIONS.keys() & _mod.PERMISSIONS.keys()
    if _overlap:
        raise ValueError(
            f"Duplicate permission keys across modules: {_overlap} "
            f"(module: {_mod.__name__})"
        )
    ALL_PERMISSIONS.update(_mod.PERMISSIONS)
    _category = _mod.__name__.rsplit(".", 1)[-1]
    for _key in _mod.PERMISSIONS:
        PERMISSION_CATEGORY[_key] = _category
