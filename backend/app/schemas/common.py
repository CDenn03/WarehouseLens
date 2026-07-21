from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    """Base for response schemas built from SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)
