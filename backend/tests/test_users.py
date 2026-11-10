from datetime import UTC, datetime, timedelta

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_moderator
from app.core.config import get_settings
from app.core.errors import ForbiddenError, NotFoundError
from app.models import User
from app.services.auth import set_role
from tests.conftest import LoginAs

# ---------- авторизация ----------


async def test_me_requires_token(client: AsyncClient) -> None:
    response = await client.get("/api/users/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


async def test_me_rejects_garbage_token(client: AsyncClient) -> None:
    response = await client.get("/api/users/me", headers={"Authorization": "Bearer abc.def"})

    assert response.status_code == 401


async def test_me_rejects_expired_token(client: AsyncClient, login_as: LoginAs) -> None:
    await login_as()
    settings = get_settings()
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    response = await client.get("/api/users/me", headers={"Authorization": f"Bearer {expired}"})

    assert response.status_code == 401
    assert "истекла" in response.json()["detail"]


async def test_me_returns_profile(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as(phone="+79120000001", name="Полина Исупова")

    response = await client.get("/api/users/me", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["phone"] == "+79120000001"
    assert body["name"] == "Полина Исупова"
    assert body["city"] == "Москва"
    assert body["role"] == "user"
    assert body["pushNotificationsEnabled"] is True


# ---------- профиль ----------


async def test_update_profile(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    response = await client.patch(
        "/api/users/me",
        headers=headers,
        json={
            "city": "Екатеринбург",
            "lastLat": 56.838,
            "lastLng": 60.597,
            "lastAddress": " ул. Малышева, 51 ",
            "name": None,  # null для обязательного поля игнорируется
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Екатеринбург"
    assert body["lastLat"] == 56.838
    assert body["lastAddress"] == "ул. Малышева, 51"
    assert body["name"] == "Полина Исупова"


async def test_update_profile_validation(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    response = await client.patch("/api/users/me", headers=headers, json={"lastLat": 120})

    assert response.status_code == 422


async def test_toggle_notifications(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    off = await client.patch(
        "/api/user/notifications", headers=headers, json={"pushNotificationsEnabled": False}
    )
    me = await client.get("/api/users/me", headers=headers)

    assert off.status_code == 200
    assert off.json()["pushNotificationsEnabled"] is False
    assert me.json()["pushNotificationsEnabled"] is False


async def test_toggle_notifications_requires_token(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/user/notifications", json={"pushNotificationsEnabled": False}
    )

    assert response.status_code == 401


# ---------- роль модератора ----------


async def test_set_role_moderator(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as(role="moderator")

    response = await client.get("/api/users/me", headers=headers)

    assert response.json()["role"] == "moderator"


async def test_set_role_unknown_phone(db: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await set_role(db, "+79990000000", "moderator")


async def test_get_moderator_dependency(login_as: LoginAs, db: AsyncSession) -> None:
    await login_as(phone="+79120000001")
    await login_as(phone="+79120000002", role="moderator")
    user = await db.scalar(select(User).where(User.phone == "+79120000001"))
    moderator = await db.scalar(select(User).where(User.phone == "+79120000002"))

    assert await get_moderator(moderator) is moderator
    with pytest.raises(ForbiddenError):
        await get_moderator(user)
