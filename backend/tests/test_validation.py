"""Ошибки валидации — по-русски, в прежнем формате FastAPI."""

import pytest
from httpx import AsyncClient

from app.core.validation import plural, translate
from tests.conftest import LoginAs


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (
            {"type": "missing", "loc": ("body", "name"), "msg": "Field required"},
            "Имя: обязательное поле",
        ),
        (
            {"type": "string_too_long", "loc": ("body", "title"), "ctx": {"max_length": 121}},
            "Заголовок: не длиннее 121 символа",
        ),
        (
            {"type": "less_than_equal", "loc": ("query", "limit"), "ctx": {"le": 500}},
            "Лимит: не больше 500",
        ),
        (
            {"type": "literal_error", "loc": ("body", "level"), "ctx": {"expected": "'a' or 'b'"}},
            "Уровень: допустимые значения: 'a' или 'b'",
        ),
        ({"type": "missing", "loc": ("body",), "msg": "Field required"}, "Нужно тело запроса"),
        (
            {"type": "value_error", "loc": ("body",), "msg": "Value error, Выберите город"},
            "Выберите город",
        ),
        (
            {"type": "json_invalid", "loc": ("body", 12), "msg": "JSON decode error"},
            "Некорректный JSON",
        ),
        ({"type": "something_new", "loc": ("body", "x"), "msg": "Original"}, "Original"),
    ],
)
def test_translate(error: dict, expected: str) -> None:
    assert translate(error) == expected


def test_plural() -> None:
    assert [plural(n, "фото", "фото", "фото") for n in (1, 2, 5)] == ["фото"] * 3
    words = [plural(n, "символ", "символа", "символов") for n in (1, 2, 5, 11, 21, 112)]
    assert words == ["символ", "символа", "символов", "символов", "символ", "символов"]


async def test_validation_response_shape(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    response = await client.post(
        "/api/contacts", headers=headers, json={"name": "А", "phone": "+79220000001"}
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert set(detail[0]) == {"type", "loc", "msg"}
    assert detail[0]["loc"] == ["body", "name"]
    assert detail[0]["msg"].startswith("Имя: не короче")
