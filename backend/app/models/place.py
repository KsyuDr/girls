from sqlalchemy import Boolean, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Place(TimestampMixin, Base):
    """Справочная точка карты: пункт помощи, больница, полиция, опасное место."""

    __tablename__ = "places"
    # По паре «название + адрес» сид понимает, что точка уже есть
    __table_args__ = (UniqueConstraint("title", "address"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(20), index=True)
    address: Mapped[str] = mapped_column(String(200))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    hours_label: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
