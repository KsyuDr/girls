import asyncio
import logging
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import AuthCode, User
from tests.conftest import TEST_CODE, age_auth_codes

PHONE = "+79123456789"
REGISTER = {
    "name": "Полина Исупова",
    "phone": "+7 912 345-67-89",
    "city": "Москва",
    "geolocationEnabled": False,
}


async def register(client: AsyncClient, **overrides: object) -> dict:
    response = await client.post("/api/auth/register", json={**REGISTER, **overrides})
    assert response.status_code == 200, response.text
    return response.json()


async def verify(client: AsyncClient, code: str = TEST_CODE, phone: str = PHONE):
    return await client.post("/api/auth/verify", json={"phone": phone, "code": code})


async def login(client: AsyncClient, phone: str = PHONE):
    return await client.post("/api/auth/login", json={"phone": phone})


async def registered(client: AsyncClient) -> None:
    """Подтверждённый пользователь; коды «состарены», чтобы сразу можно было войти."""
    await register(client)
    assert (await verify(client)).status_code == 200
    await age_auth_codes(2 * 3600)


# ---------- регистрация ----------


async def test_register_sends_code_and_creates_user_only_after_verify(
    client: AsyncClient, db: AsyncSession
) -> None:
    body = await register(client)

    assert body == {"step": 2, "smsSent": True, "phone": PHONE}
    assert await db.scalar(select(User).where(User.phone == PHONE)) is None

    assert (await verify(client)).status_code == 200
    user = await db.scalar(select(User).where(User.phone == PHONE))
    assert user is not None
    assert user.name == "Полина Исупова"
    assert user.city == "Москва"
    assert user.geolocation_enabled is False
    assert user.phone_verified_at is not None


async def test_code_is_stored_hashed(client: AsyncClient, db: AsyncSession) -> None:
    await register(client)

    auth_code = await db.scalar(select(AuthCode).where(AuthCode.phone == PHONE))
    assert auth_code is not None
    assert TEST_CODE not in auth_code.code_hash
    assert len(auth_code.code_hash) == 64
    assert auth_code.ip == "127.0.0.1"


async def test_register_validation(client: AsyncClient) -> None:
    bad_phone = await client.post("/api/auth/register", json={**REGISTER, "phone": "12345"})
    short_name = await client.post("/api/auth/register", json={**REGISTER, "name": "П"})
    no_city = await client.post(
        "/api/auth/register", json={"name": "Полина", "phone": "+79123456789"}
    )

    assert bad_phone.status_code == 422
    assert "российский номер" in bad_phone.text
    assert short_name.status_code == 422
    assert short_name.json()["detail"][0]["msg"] == "Имя: не короче 2 символов"
    assert no_city.status_code == 422
    assert no_city.json()["detail"][0]["msg"] == "Город: обязательное поле"


async def test_register_again_before_verify_uses_latest_form(
    client: AsyncClient, db: AsyncSession
) -> None:
    await register(client)
    await age_auth_codes(61)
    await register(client, name="Полина Иванова", city="Казань")
    await verify(client)

    users = (await db.scalars(select(User))).all()
    assert len(users) == 1
    assert users[0].name == "Полина Иванова"
    assert users[0].city == "Казань"


async def test_register_does_not_touch_existing_profile(
    client: AsyncClient, db: AsyncSession
) -> None:
    """Чужой человек, отправив анкету на ваш номер, не перепишет имя до ввода кода."""
    await register(client)
    await verify(client)
    user = await db.scalar(select(User).where(User.phone == PHONE))
    assert user is not None
    # старый неподтверждённый пользователь (как до этого исправления): анкета применяется по коду
    await db.execute(update(User).values(phone_verified_at=None, name="Старое Имя"))
    await db.commit()
    await age_auth_codes(61)

    await register(client, name="Чужой Человек")
    await db.refresh(user)
    assert user.name == "Старое Имя"


async def test_register_verified_phone_conflict(client: AsyncClient) -> None:
    await registered(client)

    response = await client.post("/api/auth/register", json=REGISTER)

    assert response.status_code == 409
    assert "уже зарегистрирован" in response.json()["detail"]


async def test_parallel_register_same_phone(client: AsyncClient, db: AsyncSession) -> None:
    """Двойной клик «Получить код»: один код, остальным 429, никаких 500."""
    responses = await asyncio.gather(
        *(client.post("/api/auth/register", json=REGISTER) for _ in range(8))
    )

    codes = sorted(r.status_code for r in responses)
    assert codes == [200] + [429] * 7
    assert (await verify(client)).status_code == 200
    assert await db.scalar(select(func.count()).select_from(User)) == 1


# ---------- лимиты выдачи кодов ----------


async def test_resend_not_more_than_once_a_minute(client: AsyncClient) -> None:
    await register(client)

    again = await client.post("/api/auth/register", json=REGISTER)

    assert again.status_code == 429
    assert "Новый можно запросить через" in again.json()["detail"]
    assert 0 < int(again.headers["retry-after"]) <= 60

    await age_auth_codes(61)
    assert (await client.post("/api/auth/register", json=REGISTER)).status_code == 200


async def test_codes_per_phone_per_hour(client: AsyncClient) -> None:
    limit = get_settings().auth_codes_per_phone_per_hour
    for _ in range(limit):
        await register(client)
        await age_auth_codes(61)

    response = await client.post("/api/auth/register", json=REGISTER)

    assert response.status_code == 429
    assert "попробуйте через час" in response.json()["detail"]


async def test_codes_per_ip_per_hour(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "auth_codes_per_ip_per_hour", 3)
    for n in range(3):
        await register(client, phone=f"+7912000000{n}")

    response = await client.post("/api/auth/register", json={**REGISTER, "phone": "+79120000009"})

    assert response.status_code == 429
    assert "с этого устройства" in response.json()["detail"]


async def test_login_is_rate_limited_too(client: AsyncClient) -> None:
    await registered(client)
    assert (await login(client)).status_code == 200

    assert (await login(client)).status_code == 429


# ---------- проверка кода ----------


async def test_verify_returns_token_and_user(client: AsyncClient) -> None:
    await register(client)

    response = await verify(client)

    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["accessToken"]
    user = body["user"]
    assert user["phone"] == PHONE
    assert user["role"] == "user"
    assert user["phoneVerifiedAt"] is not None
    assert user["geolocationEnabled"] is False


async def test_verify_code_is_single_use(client: AsyncClient) -> None:
    await register(client)
    assert (await verify(client)).status_code == 200

    second = await verify(client)

    assert second.status_code == 400


async def test_parallel_verify_gives_one_token(client: AsyncClient) -> None:
    await register(client)

    responses = await asyncio.gather(*(verify(client) for _ in range(6)))

    assert sorted(r.status_code for r in responses) == [200] + [400] * 5


async def test_verify_wrong_code(client: AsyncClient, db: AsyncSession) -> None:
    await register(client)

    response = await verify(client, code="9999")

    assert response.status_code == 400
    assert response.json()["detail"] == "Неверный код"
    auth_code = await db.scalar(select(AuthCode).where(AuthCode.phone == PHONE))
    assert auth_code is not None
    assert auth_code.attempts == 1


async def test_verify_too_many_attempts(client: AsyncClient) -> None:
    await register(client)
    for _ in range(5):
        assert (await verify(client, code="9999")).status_code == 400

    # даже правильный код больше не принимается
    response = await verify(client)

    assert response.status_code == 429


async def test_parallel_wrong_codes_respect_limit(client: AsyncClient, db: AsyncSession) -> None:
    """10 одновременных неверных кодов — проверено ровно 5, остальным 429."""
    await register(client)

    responses = await asyncio.gather(*(verify(client, code="9999") for _ in range(10)))

    assert sorted(r.status_code for r in responses) == [400] * 5 + [429] * 5
    auth_code = await db.scalar(select(AuthCode).where(AuthCode.phone == PHONE))
    assert auth_code is not None
    assert auth_code.attempts == 5


async def test_new_code_does_not_reset_hourly_attempts(client: AsyncClient) -> None:
    """Перебор через «запросить новый код»: за час на номер не больше 10 неверных кодов."""
    await registered(client)
    checked = 0
    for _ in range(4):
        assert (await login(client)).status_code == 200
        for _ in range(5):
            response = await verify(client, code="9999")
            if response.status_code == 400:
                checked += 1
        await age_auth_codes(61)

    assert checked == get_settings().auth_failed_attempts_per_hour
    blocked = await verify(client)
    assert blocked.status_code == 429  # и верный код тоже, пока не пройдёт час
    assert "через час" in blocked.json()["detail"]


async def test_verify_expired_code(client: AsyncClient, db: AsyncSession) -> None:
    await register(client)
    await db.execute(update(AuthCode).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
    await db.commit()

    response = await verify(client)

    assert response.status_code == 400
    assert "устарел" in response.json()["detail"]


async def test_verify_without_requested_code(client: AsyncClient) -> None:
    response = await verify(client)

    assert response.status_code == 400


async def test_verify_code_format(client: AsyncClient) -> None:
    response = await verify(client, code="12ab")

    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == "Код: неверный формат"


# ---------- вход ----------


async def test_login_unknown_phone(client: AsyncClient) -> None:
    response = await login(client, "+79990000000")

    assert response.status_code == 404


async def test_login_before_registration_is_confirmed(client: AsyncClient) -> None:
    """Анкета отправлена, код не введён — пользователя ещё нет."""
    await register(client)
    await age_auth_codes(61)

    assert (await login(client)).status_code == 404


async def test_login_existing_user(client: AsyncClient) -> None:
    await registered(client)

    response = await client.post("/api/auth/login", json={"phone": "8 912 345 67 89"})

    assert response.status_code == 200
    assert response.json()["phone"] == PHONE
    assert (await verify(client)).status_code == 200


async def test_new_code_invalidates_previous(client: AsyncClient, db: AsyncSession) -> None:
    await register(client)
    await age_auth_codes(61)
    await register(client)

    active = await db.scalar(
        select(func.count())
        .select_from(AuthCode)
        .where(AuthCode.phone == PHONE, AuthCode.used_at.is_(None))
    )
    assert active == 1


# ---------- prod без SMS-провайдера ----------


async def test_prod_does_not_log_or_fake_code(
    client: AsyncClient,
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr(get_settings(), "environment", "prod")
    caplog.set_level(logging.DEBUG, logger="safe_city.sms")

    response = await client.post("/api/auth/register", json=REGISTER)

    assert response.status_code == 503
    assert "SMS пока не подключена" in response.json()["detail"]
    assert PHONE not in caplog.text  # номер в логе маскирован
    assert "+7912***6789" in caplog.text
    assert await db.scalar(select(func.count()).select_from(AuthCode)) == 0
