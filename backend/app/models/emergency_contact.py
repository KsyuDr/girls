from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin

NOTIFY_SMS = "sms"
NOTIFY_SMS_PUSH = "sms_push"


class EmergencyContact(TimestampMixin, Base):
    """Близкий человек, которому уходит SOS. Не больше MAX_CONTACTS на пользователя."""

    __tablename__ = "emergency_contacts"
    # Один номер дважды у пользователя не нужен; индекс заодно ускоряет выборку по user_id
    __table_args__ = (UniqueConstraint("user_id", "phone"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    relation: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str] = mapped_column(String(20))
    receives_sos: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    notify_method: Mapped[str] = mapped_column(
        String(20), default=NOTIFY_SMS_PUSH, server_default=NOTIFY_SMS_PUSH
    )
    # Порядок в списке: новый контакт — в конец
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
