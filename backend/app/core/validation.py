"""Ошибки валидации (422) по-русски.

Формат ответа FastAPI сохраняем — `{"detail": [{"type", "loc", "msg"}]}`, — меняется только
`msg`: «Имя: не короче 2 символов» вместо «String should have at least 2 characters».
Фронт показывает `detail[0].msg` как есть.
"""

from collections.abc import Sequence
from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

FIELD_LABELS = {
    "name": "Имя",
    "phone": "Телефон",
    "city": "Город",
    "code": "Код",
    "title": "Заголовок",
    "subtitle": "Подзаголовок",
    "description": "Описание",
    "address": "Адрес",
    "lat": "Широта",
    "lng": "Долгота",
    "lastLat": "Широта",
    "lastLng": "Долгота",
    "lastAddress": "Адрес",
    "accuracyMeters": "Точность",
    "relation": "Кем приходится",
    "notifyMethod": "Способ уведомления",
    "receivesSos": "Получает SOS",
    "type": "Тип",
    "status": "Статус",
    "level": "Уровень",
    "message": "Сообщение",
    "moderatorNote": "Заметка",
    "locationLabel": "Место",
    "sourceLabel": "Источник",
    "actionsChecklist": "Что делать",
    "files": "Фото",
    "radius": "Радиус",
    "limit": "Лимит",
    "category": "Категория",
}


def plural(n: int, one: str, few: str, many: str) -> str:
    """plural(2, "символ", "символа", "символов") → «символа»."""
    n = abs(n)
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def _chars(n: int) -> str:
    return f"{n} {plural(n, 'символа', 'символов', 'символов')}"


def _items(n: int) -> str:
    return f"{n} {plural(n, 'элемент', 'элемента', 'элементов')}"


def _text(error_type: str, ctx: dict[str, Any], original: str) -> str | None:
    """Текст ошибки без названия поля; None — оставить сообщение Pydantic."""
    match error_type:
        case "missing":
            return "обязательное поле"
        case "string_too_short":
            return f"не короче {_chars(ctx['min_length'])}"
        case "string_too_long":
            return f"не длиннее {_chars(ctx['max_length'])}"
        case "too_short":
            return f"нужно хотя бы {_items(ctx['min_length'])}"
        case "too_long":
            return f"не больше {_items(ctx['max_length'])}"
        case "greater_than_equal":
            return f"не меньше {ctx['ge']}"
        case "greater_than":
            return f"больше {ctx['gt']}"
        case "less_than_equal":
            return f"не больше {ctx['le']}"
        case "less_than":
            return f"меньше {ctx['lt']}"
        case "string_pattern_mismatch":
            return "неверный формат"
        case "string_type":
            return "должно быть строкой"
        case "int_parsing" | "int_type" | "int_from_float":
            return "должно быть целым числом"
        case "float_parsing" | "float_type" | "finite_number":
            return "должно быть числом"
        case "bool_parsing" | "bool_type":
            return "должно быть true или false"
        case "literal_error" | "enum":
            return f"допустимые значения: {ctx['expected']}".replace(" or ", " или ")
        case "list_type":
            return "ожидается список"
        case "model_type" | "model_attributes_type" | "dict_type":
            return "ожидается объект"
        case "json_invalid":
            return "некорректный JSON"
        case "value_error" | "assertion_error":
            # Свои проверки уже пишут по-русски; убираем приставку Pydantic
            return original.removeprefix("Value error, ").removeprefix("Assertion failed, ")
    return None


def _field(loc: Sequence[str | int]) -> str | None:
    names = [part for part in loc[1:] if isinstance(part, str)]
    if not names:
        return None
    return FIELD_LABELS.get(names[-1], names[-1])


def translate(error: dict[str, Any]) -> str:
    error_type = error.get("type", "")
    loc = error.get("loc", ())
    original = str(error.get("msg", ""))
    if error_type == "missing" and len(loc) == 1 and loc[0] == "body":
        return "Нужно тело запроса"
    text = _text(error_type, error.get("ctx") or {}, original)
    if text is None:
        return original
    if error_type in ("value_error", "assertion_error"):
        return text  # готовая фраза, например «Передайте обе координаты: lat и lng»
    field = _field(loc)
    return f"{field}: {text}" if field else text[:1].upper() + text[1:]


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    detail = [
        {"type": e.get("type"), "loc": e.get("loc"), "msg": translate(e)} for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(detail)})
