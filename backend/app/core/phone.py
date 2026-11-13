"""Нормализация российских номеров телефона к виду +79123456789."""

import re

# Только ASCII-цифры: \D в Python юникодный и пропустил бы «９» и «٩» как цифры
_NON_DIGITS = re.compile(r"[^0-9]")


def normalize_phone(raw: str) -> str:
    """Принимает «+7 912 345-67-89», «8 (912) 345-67-89», «9123456789».

    Бросает ValueError, если это не российский мобильный/городской номер из 11 цифр.
    """
    if any(ch.isdigit() and not ch.isascii() for ch in raw):
        # «９» или «٩» — не та же цифра: иначе один номер записывается по-разному
        raise ValueError("Номер телефона: используйте обычные цифры 0–9")
    digits = _NON_DIGITS.sub("", raw)
    if len(digits) == 10:
        digits = "7" + digits
    elif len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) != 11 or not digits.startswith("7"):
        raise ValueError("Введите российский номер телефона, например +7 912 345-67-89")
    return "+" + digits
