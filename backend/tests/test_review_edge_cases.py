"""Ревью 2026-11-12: крайние случаи и гонки.

Первая часть — регрессионные тесты на ошибки Р1–Р8 (см. agents/08-review.md, раздел
«Третье ревью»), вторая — крайние случаи, которые работали и до исправлений.

Через ASGITransport необработанное исключение приложения не превращается в 500, а летит в тест;
`status_or_500` делает из него 500, как ответил бы живой сервер.
"""

import asyncio
import json
from collections.abc import Awaitable

import pytest
from httpx import AsyncClient, Response

from app.core.config import get_settings
from app.core.phone import normalize_phone
from app.services import sms
from tests.conftest import Headers, LoginAs

HUGE_ID = 99_999_999_999  # больше int4: PostgreSQL не примет такой параметр
POINT = {"lat": 55.7539, "lng": 37.6208}


async def status_or_500(request: Awaitable[Response]) -> int:
    try:
        return (await request).status_code
    except Exception:  # живой сервер ответил бы 500
        return 500


async def add_contact(client: AsyncClient, headers: Headers, phone: str) -> dict:
    response = await client.post(
        "/api/contacts", headers=headers, json={"name": "Мама", "phone": phone}
    )
    assert response.status_code == 201, response.text
    return response.json()


# ---------- id вне диапазона int4 ----------


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("GET", f"/api/incidents/{HUGE_ID}"),
        ("GET", f"/api/alerts/{HUGE_ID}"),
        ("GET", f"/api/sos/{HUGE_ID}"),
        ("PATCH", f"/api/contacts/{HUGE_ID}"),
        ("DELETE", f"/api/contacts/{HUGE_ID}"),
        ("POST", f"/api/sos/{HUGE_ID}/cancel"),
        ("POST", f"/api/incidents/{HUGE_ID}/responses"),
    ],
)
async def test_huge_id_in_path_is_not_500(
    client: AsyncClient, login_as: LoginAs, method: str, url: str
) -> None:
    headers = await login_as()
    body = {"name": "Мама"} if method == "PATCH" else None
    code = await status_or_500(client.request(method, url, headers=headers, json=body))
    assert code in (404, 422)


async def test_negative_id_is_404(client: AsyncClient) -> None:
    assert (await client.get("/api/incidents/-1")).status_code == 404


# ---------- NUL-символ в тексте ----------


@pytest.mark.parametrize(
    ("url", "body"),
    [
        ("/api/auth/register", {"name": "Пол\x00ина", "phone": "+79120000099", "city": "Москва"}),
        ("/api/contacts", {"name": "Ма\x00ма", "phone": "+79120000077"}),
        (
            "/api/incidents",
            {"type": "fire", "description": "дым\x00дым", "address": "Тверская, 1", **POINT},
        ),
        ("/api/sos", {"address": "Тверская\x00 1"}),
    ],
)
async def test_nul_byte_is_validation_error(
    client: AsyncClient, login_as: LoginAs, url: str, body: dict
) -> None:
    headers = await login_as()
    assert await status_or_500(client.post(url, headers=headers, json=body)) == 422


# ---------- номер телефона с не-ASCII цифрами ----------


@pytest.mark.parametrize("raw", ["+7９１２３４５６７８９", "+7 912 345 67 8٩"])
def test_normalize_phone_accepts_only_ascii_digits(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_phone(raw)


async def test_own_phone_with_fullwidth_digit_is_rejected(
    client: AsyncClient, login_as: LoginAs
) -> None:
    headers = await login_as(phone="+79120000001")
    response = await client.post(
        "/api/contacts", headers=headers, json={"name": "Я сама", "phone": "+791200000０１"}
    )
    assert response.status_code in (400, 422)


# ---------- гонки ----------


async def test_contact_patch_and_delete_at_once(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    codes = set()
    for i in range(30):
        contact = await add_contact(client, headers, f"+7912555{i:04d}")
        url = f"/api/contacts/{contact['id']}"
        patch, delete = await asyncio.gather(
            status_or_500(client.patch(url, headers=headers, json={"receivesSos": False})),
            status_or_500(client.delete(url, headers=headers)),
        )
        codes |= {patch, delete}
    assert 500 not in codes  # ожидаем 200/404 у PATCH и 204 у DELETE


async def test_sos_while_contact_is_deleted(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    codes = set()
    for i in range(30):
        contact = await add_contact(client, headers, f"+7912666{i:04d}")
        sos, _ = await asyncio.gather(
            status_or_500(client.post("/api/sos", headers=headers, json={})),
            status_or_500(client.delete(f"/api/contacts/{contact['id']}", headers=headers)),
        )
        codes.add(sos)
        await client.post("/api/sos/active/cancel", headers=headers)
    assert codes <= {200, 201}


async def test_cancel_while_sos_is_being_delivered(
    client: AsyncClient, login_as: LoginAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await login_as()
    for i in range(3):
        await add_contact(client, headers, f"+7912777{i:04d}")
    sent: list[tuple[str, str]] = []

    async def slow_send_sos(phone: str, *_: object) -> bool:
        await asyncio.sleep(0.3)  # настоящий провайдер отвечает не мгновенно
        sent.append(("sos", phone))
        return True

    async def send_cancelled(phone: str, *_: object) -> None:
        sent.append(("cancel", phone))

    monkeypatch.setattr(sms, "send_sos", slow_send_sos)
    monkeypatch.setattr(sms, "send_sos_cancelled", send_cancelled)

    async def cancel_soon() -> Response:
        await asyncio.sleep(0.15)
        return await client.post("/api/sos/active/cancel", headers=headers)

    created, cancelled = await asyncio.gather(
        client.post("/api/sos", headers=headers, json={}), cancel_soon()
    )
    assert cancelled.status_code == 200
    got_sos = {phone for kind, phone in sent if kind == "sos"}
    got_cancel = {phone for kind, phone in sent if kind == "cancel"}
    # Кто получил SOS, должен получить и отбой
    assert got_sos <= got_cancel, (created.json()["status"], sent)


# ---------- крайние случаи, которые уже работают ----------


async def test_nan_and_infinity_are_rejected(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    assert (await client.get("/api/incidents?lat=nan&lng=nan")).status_code == 422
    assert (await client.get("/api/places?lat=inf&lng=37")).status_code == 422
    raw = {**headers, "content-type": "application/json"}
    for body in (b'{"lat": NaN, "lng": 37.6}', b'{"accuracyMeters": Infinity}'):
        assert (await client.post("/api/sos", headers=raw, content=body)).status_code == 422
    assert (await client.get("/api/sos/active", headers=headers)).json() is None


async def test_deeply_nested_json_is_client_error(client: AsyncClient, login_as: LoginAs) -> None:
    headers = {**await login_as(), "content-type": "application/json"}
    body = ("[" * 50_000 + "]" * 50_000).encode()
    response = await client.post("/api/contacts", headers=headers, content=body)
    assert response.status_code == 400
    assert response.json()["detail"] == "Не удалось разобрать тело запроса"


@pytest.mark.parametrize(
    "path",
    [
        "/media/../app/main.py",
        "/media/..%2fapp%2fmain.py",
        "/media/incidents/../../pyproject.toml",
        "/media/%2e%2e/%2e%2e/pyproject.toml",
    ],
)
async def test_media_path_traversal(client: AsyncClient, path: str) -> None:
    assert (await client.get(path)).status_code == 404


async def test_cors_rejects_foreign_origin(client: AsyncClient) -> None:
    response = await client.options(
        "/api/sos",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in response.headers
    # Регулярное выражение для dev целиком: поддомен с localhost в начале не пройдёт
    response = await client.get("/api/health", headers={"Origin": "http://localhost.evil.example"})
    assert "access-control-allow-origin" not in response.headers


async def test_register_with_html_name_is_stored_as_text(client: AsyncClient) -> None:
    phone = "+79120000055"
    name = '<img src=x onerror="alert(1)">'
    await client.post("/api/auth/register", json={"name": name, "phone": phone, "city": "Москва"})
    response = await client.post("/api/auth/verify", json={"phone": phone, "code": "0000"})
    assert response.json()["user"]["name"] == name  # экранирует фронт (React), не бэкенд


async def test_respond_and_close_at_once_is_consistent(
    client: AsyncClient, login_as: LoginAs
) -> None:
    author = await login_as("+79120000001", "Автор Меток")
    helper = await login_as("+79120000002", "Помощник Быстрый")
    for _ in range(10):
        incident = (
            await client.post(
                "/api/incidents",
                headers=author,
                json={"type": "fire", "description": "Дым", "address": "Тверская, 1", **POINT},
            )
        ).json()
        url = f"/api/incidents/{incident['id']}"
        respond, close = await asyncio.gather(
            status_or_500(client.post(f"{url}/responses", headers=helper, json={})),
            status_or_500(client.patch(url, headers=author, json={"status": "closed"})),
        )
        assert close == 200
        assert respond in (201, 409)
        final = (await client.get(url, headers=author)).json()
        # После закрытия активных откликов не остаётся: успевший отклик стал «done»
        assert final["responsesCount"] == 0
        assert all(r["status"] == "done" for r in final["responses"])


async def test_hide_and_respond_at_once(client: AsyncClient, login_as: LoginAs) -> None:
    author = await login_as("+79120000001", "Автор Меток")
    helper = await login_as("+79120000002", "Помощник Быстрый")
    moderator = await login_as("+79120000003", "Модератор Строгий", role="moderator")
    for _ in range(10):
        incident = (
            await client.post(
                "/api/incidents",
                headers=author,
                json={"type": "fire", "description": "Дым", "address": "Тверская, 1", **POINT},
            )
        ).json()
        url = f"/api/incidents/{incident['id']}"
        respond, hide = await asyncio.gather(
            status_or_500(client.post(f"{url}/responses", headers=helper, json={})),
            status_or_500(
                client.patch(
                    f"/api/moderation/incidents/{incident['id']}",
                    headers=moderator,
                    json={"status": "hidden"},
                )
            ),
        )
        assert hide == 200
        assert respond in (201, 404, 409)
        assert (await client.get(url, headers=helper)).status_code == 404


async def test_location_and_resolve_at_once_never_revive(
    client: AsyncClient, login_as: LoginAs
) -> None:
    user = await login_as("+79120000001")
    moderator = await login_as("+79120000003", "Модератор Строгий", role="moderator")
    for _ in range(10):
        sos = (await client.post("/api/sos", headers=user, json={})).json()
        location_url = f"/api/sos/{sos['id']}/location"
        resolve_url = f"/api/moderation/sos/{sos['id']}/resolve"
        location, resolve = await asyncio.gather(
            status_or_500(client.post(location_url, headers=user, json=POINT)),
            status_or_500(client.post(resolve_url, headers=moderator)),
        )
        assert resolve == 200
        assert location in (200, 409)
        assert (await client.get("/api/sos/active", headers=user)).json() is None


async def test_sos_sms_limit_per_hour(
    client: AsyncClient, login_as: LoginAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Р7: сигнал создаётся всегда (человек в беде не получает ошибку), но SMS — в пределах
    лимита сигналов в час."""
    monkeypatch.setattr(get_settings(), "sos_with_sms_per_hour", 3)
    headers = await login_as()
    await add_contact(client, headers, "+79128880000")
    statuses = []
    for _ in range(5):
        created = await client.post("/api/sos", headers=headers, json={})
        assert created.status_code == 201
        statuses.append(created.json()["notifiedContacts"][0]["status"])
        assert (await client.post("/api/sos/active/cancel", headers=headers)).status_code == 200
    assert statuses == ["delivered"] * 3 + ["failed"] * 2


async def test_sos_sms_limit_of_numbers_per_day(
    client: AsyncClient, login_as: LoginAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Р7: сменой контактов нельзя разослать SOS на бесконечное число чужих номеров."""
    monkeypatch.setattr(get_settings(), "sos_sms_numbers_per_day", 3)
    headers = await login_as()
    first = [await add_contact(client, headers, f"+791288800{i:02d}") for i in range(2)]
    await client.post("/api/sos", headers=headers, json={})
    await client.post("/api/sos/active/cancel", headers=headers)
    for contact in first[1:]:
        await client.delete(f"/api/contacts/{contact['id']}", headers=headers)
    for i in range(2, 5):
        await add_contact(client, headers, f"+791288800{i:02d}")
    sos = (await client.post("/api/sos", headers=headers, json={})).json()
    got = {d["phone"]: d["status"] for d in sos["notifiedContacts"]}
    # Первый номер уже получал SOS — лимит не тратит; из новых проходит один (3 − 2)
    assert got == {
        "+79128880000": "delivered",
        "+79128880002": "delivered",
        "+79128880003": "failed",
        "+79128880004": "failed",
    }


async def test_incident_limit_per_hour(
    client: AsyncClient, login_as: LoginAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "incidents_per_hour", 3)
    headers = await login_as()
    body = {"type": "fire", "description": "Спам", "address": "Тверская, 1", **POINT}
    codes = await asyncio.gather(
        *(client.post("/api/incidents", headers=headers, json=body) for _ in range(5))
    )
    assert sorted(r.status_code for r in codes) == [201, 201, 201, 429, 429]


async def test_huge_id_message_is_russian(client: AsyncClient) -> None:
    response = await client.get(f"/api/incidents/{HUGE_ID}")
    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == "Номер: не больше 2147483647"


async def test_control_chars_message(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    response = await client.post(
        "/api/contacts", headers=headers, json={"name": "Ма\x07ма", "phone": "+79120000077"}
    )
    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == "Текст содержит недопустимые символы"
    # Перевод строки и табуляция в описании допустимы
    body = {"type": "fire", "description": "Дым\n\tиз окна", "address": "Тверская, 1", **POINT}
    assert (await client.post("/api/incidents", headers=headers, json=body)).status_code == 201


async def test_media_path_with_nul_is_404(client: AsyncClient) -> None:
    assert (await client.get("/media/incidents/a%00b.jpg")).status_code == 404


async def test_empty_strings_become_null(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    sos = (await client.post("/api/sos", headers=headers, json={"address": "  "})).json()
    assert sos["address"] is None
    moderator = await login_as("+79120000003", "Модератор Строгий", role="moderator")
    alert = (
        await client.post(
            "/api/alerts",
            headers=moderator,
            json={
                "title": "Гроза",
                "description": "Сильный ветер",
                "subtitle": "",
                "sourceLabel": "",
            },
        )
    ).json()
    assert alert["subtitle"] is None and alert["sourceLabel"] is None


async def test_dashboard_survives_parallel_load(client: AsyncClient, login_as: LoginAs) -> None:
    moderator = await login_as("+79120000003", "Модератор Строгий", role="moderator")
    responses = await asyncio.gather(
        *[client.get("/api/dashboard", headers=moderator if i % 2 else {}) for i in range(60)]
    )
    assert {r.status_code for r in responses} == {200}
    assert json.loads(responses[1].content)["moderation"] is not None
