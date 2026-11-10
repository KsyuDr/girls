from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.user import User

STATUS_NEW = "new"
STATUS_IN_PROGRESS = "in_progress"
STATUS_CLOSED = "closed"
STATUS_HIDDEN = "hidden"  # скрыта модератором: наружу не отдаётся
INCIDENT_STATUSES = (STATUS_NEW, STATUS_IN_PROGRESS, STATUS_CLOSED, STATUS_HIDDEN)
PUBLIC_STATUSES = (STATUS_NEW, STATUS_IN_PROGRESS, STATUS_CLOSED)

RESPONSE_ACTIVE = "active"
RESPONSE_CANCELLED = "cancelled"
RESPONSE_DONE = "done"


class Incident(TimestampMixin, Base):
    """Метка жителя на карте: опасность, просьба о помощи, потеряно/найдено."""

    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(20), index=True)
    description: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(String(200))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    status: Mapped[str] = mapped_column(
        String(20), default=STATUS_NEW, server_default=STATUS_NEW, index=True
    )
    moderator_note: Mapped[str | None] = mapped_column(Text)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Когда модератор впервые взял метку в работу (для «среднего времени реакции»)
    reacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    author: Mapped[User] = relationship(lazy="raise")
    photos: Mapped[list["IncidentPhoto"]] = relationship(
        lazy="raise", cascade="all, delete-orphan", order_by="IncidentPhoto.id"
    )
    responses: Mapped[list["IncidentResponse"]] = relationship(
        lazy="raise", cascade="all, delete-orphan", order_by="IncidentResponse.id"
    )


class IncidentPhoto(TimestampMixin, Base):
    __tablename__ = "incident_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"), index=True
    )
    # Путь относительно MEDIA_DIR, например incidents/12/3f9c….jpg
    file_path: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int] = mapped_column(Integer)


class IncidentResponse(TimestampMixin, Base):
    """Отклик «Помогу» / «Нашёл» на чужую метку."""

    __tablename__ = "incident_responses"
    __table_args__ = (UniqueConstraint("incident_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(
        String(20), default=RESPONSE_ACTIVE, server_default=RESPONSE_ACTIVE
    )

    user: Mapped[User] = relationship(lazy="raise")
