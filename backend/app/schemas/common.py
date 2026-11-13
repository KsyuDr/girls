"""Общие схемы Pydantic.

Фронтенд (src/services/api.js) работает с camelCase, а в Python пишем snake_case.
Все схемы наследуются от CamelModel: в JSON поля уходят в camelCase,
а на вход принимаются оба варианта.
"""

import re
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator
from pydantic.alias_generators import to_camel

# Управляющие символы, кроме табуляции и переводов строки. NUL PostgreSQL не хранит вовсе (500),
# остальные в тексте для людей не нужны и ломают вывод.
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
CONTROL_CHARS_ERROR = "Текст содержит недопустимые символы"


def has_control_chars(value: Any) -> bool:
    """Ищет управляющие символы в строках на любой глубине (списки, вложенные объекты).

    Обход без рекурсии: глубоко вложенный JSON не уронит сервер RecursionError.
    """
    stack = [value]
    while stack:
        item = stack.pop()
        if isinstance(item, str):
            if _CONTROL_CHARS.search(item):
                return True
        elif isinstance(item, dict):
            stack.extend(item.keys())
            stack.extend(item.values())
        elif isinstance(item, list | tuple):
            stack.extend(item)
    return False


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class InputModel(CamelModel):
    """База для тел запросов: тексты без управляющих символов (иначе 422, а не 500 из БД)."""

    @model_validator(mode="before")
    @classmethod
    def _no_control_chars(cls, data: Any) -> Any:
        if isinstance(data, dict) and has_control_chars(data):
            raise ValueError(CONTROL_CHARS_ERROR)
        return data


class HealthOut(CamelModel):
    status: str
    database: str
    version: str
