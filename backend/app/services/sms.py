"""Отправка SMS. В MVP — заглушка: код пишется в лог сервера.

Реальный провайдер подключается здесь же, интерфейс send_code не меняется.
"""

import logging

logger = logging.getLogger("safe_city.sms")


async def send_code(phone: str, code: str) -> None:
    # Латиница намеренно: консоль Windows часто не показывает кириллицу в логах
    logger.warning("[SMS MOCK] %s: code %s", phone, code)


async def send_sos(phone: str, from_user_id: int, lat: float | None, lng: float | None) -> bool:
    """Сообщение близкому о SOS. Возвращает True, если провайдер принял сообщение."""
    where = f"{lat:.5f},{lng:.5f}" if lat is not None and lng is not None else "unknown location"
    logger.warning("[SMS MOCK] %s: SOS from user #%s at %s", phone, from_user_id, where)
    return True


async def send_sos_cancelled(phone: str, from_user_id: int) -> None:
    logger.warning("[SMS MOCK] %s: SOS from user #%s cancelled", phone, from_user_id)
