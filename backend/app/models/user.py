from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin

ROLE_USER = "user"
ROLE_MODERATOR = "moderator"
ROLES = (ROLE_USER, ROLE_MODERATOR)


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(60))
    role: Mapped[str] = mapped_column(String(20), default=ROLE_USER, server_default=ROLE_USER)

    geolocation_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    push_notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    phone_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    last_lat: Mapped[float | None] = mapped_column(Float)
    last_lng: Mapped[float | None] = mapped_column(Float)
    last_address: Mapped[str | None] = mapped_column(String(200))

    @property
    def is_moderator(self) -> bool:
        return self.role == ROLE_MODERATOR
