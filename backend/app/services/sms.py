"""Отправка SMS. В MVP — заглушка: в dev/test код пишется в лог сервера.

Реальный провайдер подключается здесь же, интерфейс send_code не меняется. Пока его нет,
в prod код не отправляется и не попадает в лог (иначе любой с доступом к логам войдёт
в любой аккаунт) — регистрация и вход отвечают 503.
"""

import logging

from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError

logger = logging.getLogger("safe_city.sms")


def mask_phone(phone: str) -> str:
    """+79123456789 → +7912***6789: в логах prod номер целиком не нужен."""
    return f"{phone[:5]}***{phone[-4:]}" if len(phone) > 9 else "***"


async def send_code(phone: str, code: str) -> None:
    if not get_settings().is_dev:
        logger.error("SMS provider is not configured, code for %s not sent", mask_phone(phone))
        raise ServiceUnavailableError("Отправка SMS пока не подключена — вход временно недоступен")
    # Латиница намеренно: консоль Windows часто не показывает кириллицу в логах
    logger.warning("[SMS MOCK] %s: code %s", phone, code)


async def send_sos(phone: str, from_user_id: int, lat: float | None, lng: float | None) -> bool:
    """Сообщение близкому о SOS. Возвращает True, если провайдер принял сообщение."""
    where = f"{lat:.5f},{lng:.5f}" if lat is not None and lng is not None else "unknown location"
    logger.warning("[SMS MOCK] %s: SOS from user #%s at %s", phone, from_user_id, where)
    return True


async def send_sos_cancelled(phone: str, from_user_id: int) -> None:
    logger.warning("[SMS MOCK] %s: SOS from user #%s cancelled", phone, from_user_id)


async def send_sos_resolved(phone: str, from_user_id: int) -> None:
    """Модератор отметил, что помощь пришла: близкий должен знать, что всё хорошо."""
    logger.warning("[SMS MOCK] %s: SOS from user #%s resolved, help arrived", phone, from_user_id)
