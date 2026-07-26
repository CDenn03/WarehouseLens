class WarehouseLensError(Exception):
    """Base for domain errors. The API layer maps these to HTTP responses."""

    status_code = 400

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class NotFoundError(WarehouseLensError):
    status_code = 404


class ConflictError(WarehouseLensError):
    """State-machine violations: receiving a cancelled PO, shipping before picking, etc."""

    status_code = 409


class InsufficientStockError(ConflictError):
    pass


class ForbiddenError(WarehouseLensError):
    """Role or warehouse-scope violations (Section 9)."""

    status_code = 403


class UpstreamError(WarehouseLensError):
    """A dependency the request needs (Keycloak) is unreachable, rejected the
    call, or was never configured.  Distinct from a 500 because the WarehouseLens
    request itself was well-formed — the identity provider is what failed."""

    status_code = 502
