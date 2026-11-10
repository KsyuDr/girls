"""Нормализация российских номеров телефона к виду +79123456789."""

import re

_NON_DIGITS = re.compile(r"\D")


def normalize_phone(raw: str) -> str:
    """Принимает «+7 912 345-67-89», «8 (912) 345-67-89», «9123456789».

    Бросает ValueError, если это не российский мобильный/городской номер из 11 цифр.
    """
    digits = _NON_DIGITS.sub("", raw)
    if len(digits) == 10:
        digits = "7" + digits
    elif len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) != 11 or not digits.startswith("7"):
        raise ValueError("Введите российский номер телефона, например +7 912 345-67-89")
    return "+" + digits
