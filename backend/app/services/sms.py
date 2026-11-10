"""Отправка SMS. В MVP — заглушка: код пишется в лог сервера.

Реальный провайдер подключается здесь же, интерфейс send_code не меняется.
"""

import logging

logger = logging.getLogger("safe_city.sms")


async def send_code(phone: str, code: str) -> None:
    # Латиница намеренно: консоль Windows часто не показывает кириллицу в логах
    logger.warning("[SMS MOCK] %s: code %s", phone, code)
