DASHBOARD_READ = "dashboard.read"
DASHBOARD_TENANT = "dashboard.tenant"
DASHBOARD_PLATFORM = "dashboard.platform"

PERMISSIONS = {
    DASHBOARD_READ: "View operational dashboard",
    DASHBOARD_TENANT: "View tenant administration dashboard",
    DASHBOARD_PLATFORM: "View platform administration dashboard",
}

# Which dashboard a caller lands on, highest precedence first.
#
# The dashboard.* namespace is the routing table: holding a permission is what
# grants a dashboard, so adding a new one here is the only step needed to add a
# new landing page.  Precedence matters because a user may hold more than one
# (a platform admin who is also a tenant admin), and "broadest scope wins" keeps
# that deterministic instead of depending on role-assignment order.
DASHBOARD_PRECEDENCE: tuple[tuple[str, str], ...] = (
    (DASHBOARD_PLATFORM, "platform"),
    (DASHBOARD_TENANT, "tenant"),
    (DASHBOARD_READ, "operations"),
)


def resolve_dashboard(permissions: set[str]) -> str | None:
    """Return the dashboard kind for ``permissions``, or None if the caller
    holds no dashboard permission at all.

    None is meaningful: it means the user has no landing page, and the frontend
    shows an explicit "no dashboard assigned" state rather than routing them to
    a page that will 403 on every request.
    """
    for permission, kind in DASHBOARD_PRECEDENCE:
        if permission in permissions:
            return kind
    return None
