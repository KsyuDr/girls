from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuthCode, User
from tests.conftest import TEST_CODE

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


# ---------- регистрация ----------


async def test_register_sends_code(client: AsyncClient, db: AsyncSession) -> None:
    body = await register(client)

    assert body == {"step": 2, "smsSent": True, "phone": PHONE}
    user = await db.scalar(select(User).where(User.phone == PHONE))
    assert user is not None
    assert user.name == "Полина Исупова"
    assert user.geolocation_enabled is False
    assert user.phone_verified_at is None


async def test_code_is_stored_hashed(client: AsyncClient, db: AsyncSession) -> None:
    await register(client)

    auth_code = await db.scalar(select(AuthCode).where(AuthCode.phone == PHONE))
    assert auth_code is not None
    assert TEST_CODE not in auth_code.code_hash
    assert len(auth_code.code_hash) == 64


async def test_register_validation(client: AsyncClient) -> None:
    bad_phone = await client.post("/api/auth/register", json={**REGISTER, "phone": "12345"})
    short_name = await client.post("/api/auth/register", json={**REGISTER, "name": "П"})
    no_city = await client.post(
        "/api/auth/register", json={"name": "Полина", "phone": "+79123456789"}
    )

    assert bad_phone.status_code == 422
    assert "российский номер" in bad_phone.text
    assert short_name.status_code == 422
    assert no_city.status_code == 422


async def test_register_twice_before_verify_updates_data(
    client: AsyncClient, db: AsyncSession
) -> None:
    await register(client)
    await register(client, name="Полина Иванова", city="Казань")

    users = (await db.scalars(select(User))).all()
    assert len(users) == 1
    assert users[0].name == "Полина Иванова"
    assert users[0].city == "Казань"


async def test_register_verified_phone_conflict(client: AsyncClient) -> None:
    await register(client)
    await verify(client)

    response = await client.post("/api/auth/register", json=REGISTER)

    assert response.status_code == 409
    assert "уже зарегистрирован" in response.json()["detail"]


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


# ---------- вход ----------


async def test_login_unknown_phone(client: AsyncClient) -> None:
    response = await client.post("/api/auth/login", json={"phone": "+79990000000"})

    assert response.status_code == 404


async def test_login_existing_user(client: AsyncClient, db: AsyncSession) -> None:
    await register(client)
    await verify(client)

    response = await client.post("/api/auth/login", json={"phone": "8 912 345 67 89"})

    assert response.status_code == 200
    assert response.json()["phone"] == PHONE
    assert (await verify(client)).status_code == 200


async def test_new_code_invalidates_previous(client: AsyncClient, db: AsyncSession) -> None:
    await register(client)
    await client.post("/api/auth/login", json={"phone": PHONE})

    active = await db.scalar(
        select(func.count())
        .select_from(AuthCode)
        .where(AuthCode.phone == PHONE, AuthCode.used_at.is_(None))
    )
    assert active == 1
