from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AuthCode(TimestampMixin, Base):
    """Одноразовый код входа, отправленный по SMS. Сам код не храним — только хеш.

    У кода регистрации здесь же лежат данные анкеты: пользователь создаётся (или
    заполняется) только после ввода кода, поэтому чужой человек не перепишет имя и город.
    """

    __tablename__ = "auth_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # С какого адреса запросили код — для лимита выдачи кодов на IP
    ip: Mapped[str | None] = mapped_column(String(45), index=True)

    # Анкета регистрации; у кода входа — null
    name: Mapped[str | None] = mapped_column(String(100))
    city: Mapped[str | None] = mapped_column(String(60))
    geolocation_enabled: Mapped[bool | None] = mapped_column(Boolean)
