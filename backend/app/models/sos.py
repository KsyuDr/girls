from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.user import User

SOS_ACTIVE = "active"
SOS_CANCELLED = "cancelled"  # отменил сам пользователь
SOS_RESOLVED = "resolved"  # закрыл модератор: помощь пришла
SOS_STATUSES = (SOS_ACTIVE, SOS_CANCELLED, SOS_RESOLVED)

DELIVERY_SENDING = "sending"
DELIVERY_DELIVERED = "delivered"
DELIVERY_FAILED = "failed"


class SosSignal(TimestampMixin, Base):
    """Сигнал SOS. У пользователя не больше одного активного (частичный уникальный индекс)."""

    __tablename__ = "sos_signals"
    __table_args__ = (
        Index(
            "uq_sos_signals_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Координат может не быть: SOS нельзя блокировать из-за выключенной геолокации
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    address: Mapped[str | None] = mapped_column(String(200))
    accuracy_m: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(
        String(20), default=SOS_ACTIVE, server_default=SOS_ACTIVE, index=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(lazy="raise")
    deliveries: Mapped[list["SosDelivery"]] = relationship(
        lazy="raise", cascade="all, delete-orphan", order_by="SosDelivery.id"
    )


class SosDelivery(TimestampMixin, Base):
    """Кому ушёл SOS. Имя и номер копируем: контакт могут удалить, а история должна остаться."""

    __tablename__ = "sos_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sos_id: Mapped[int] = mapped_column(
        ForeignKey("sos_signals.id", ondelete="CASCADE"), index=True
    )
    contact_id: Mapped[int | None] = mapped_column(
        ForeignKey("emergency_contacts.id", ondelete="SET NULL")
    )
    contact_name: Mapped[str] = mapped_column(String(100))
    contact_relation: Mapped[str] = mapped_column(String(50))
    contact_phone: Mapped[str] = mapped_column(String(20))
    channel: Mapped[str] = mapped_column(String(20))  # sms | sms_push
    status: Mapped[str] = mapped_column(
        String(20), default=DELIVERY_SENDING, server_default=DELIVERY_SENDING
    )
