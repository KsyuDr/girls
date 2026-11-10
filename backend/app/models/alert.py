from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin

ALERT_LEVELS = ("critical", "warning", "info")
DEFAULT_LOCATION = "Весь город"


class Alert(TimestampMixin, Base):
    """Оповещение для всех жителей. Публикует модератор."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    subtitle: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(20), index=True)
    location_label: Mapped[str] = mapped_column(
        String(100), default=DEFAULT_LOCATION, server_default=DEFAULT_LOCATION
    )
    source_label: Mapped[str | None] = mapped_column(String(100))
    actions_checklist: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    # Автор может удалить аккаунт — оповещение остаётся
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
