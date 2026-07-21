from uuid import UUID

from pydantic import BaseModel


class AgentQuery(BaseModel):
    question: str
    warehouse_id: UUID | None = None


class AgentAnswer(BaseModel):
    answer: str
    tool_used: str | None = None
    data: dict | list | None = None


class ForecastPoint(BaseModel):
    date: str
    yhat: float
    yhat_lower: float | None = None
    yhat_upper: float | None = None


class ForecastResponse(BaseModel):
    product_id: UUID
    warehouse_id: UUID
    horizon_days: int
    model: str
    points: list[ForecastPoint]
