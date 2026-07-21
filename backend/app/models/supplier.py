from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, UuidPkMixin


class Supplier(Base, UuidPkMixin, CreatedAtMixin):
    __tablename__ = "suppliers"

    name: Mapped[str] = mapped_column(String(200))
    lead_time_days: Mapped[int | None]
    contact_email: Mapped[str | None] = mapped_column(String(200))
