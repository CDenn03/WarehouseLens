from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    """Base for response schemas built from SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel):
    """Standard envelope for paginated list endpoints."""

    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
