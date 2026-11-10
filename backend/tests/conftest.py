"""Общие фикстуры тестов.

Тесты работают с отдельной базой safe_city_test (создаётся docker/init-test-db.sql).
Перед запуском: `docker compose up -d db` в корне репозитория.
"""

import os
import tempfile

# Всегда тестовая база (фикстуры делают drop_all!). Переопределяется через TEST_DATABASE_URL.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://safe_city:safe_city@localhost:5433/safe_city_test",
)
os.environ["ENVIRONMENT"] = "test"
# Фото из тестов — во временную папку, а не в backend/media
os.environ["MEDIA_DIR"] = tempfile.mkdtemp(prefix="safe_city_media_")

from collections.abc import AsyncIterator, Awaitable, Callable

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionFactory, engine
from app.main import app
from app.models import Base
from app.services.auth import set_role

TEST_CODE = "0000"  # SMS_MOCK_CODE по умолчанию


@pytest.fixture(scope="session", autouse=True)
async def _prepare_database() -> AsyncIterator[None]:
    """Пересоздаём схему один раз на весь прогон тестов."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def _clean_tables() -> AsyncIterator[None]:
    """После каждого теста очищаем все таблицы — тесты не зависят друг от друга."""
    yield
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    if tables:
        async with engine.begin() as conn:
            await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db() -> AsyncIterator[AsyncSession]:
    """Прямой доступ к базе — чтобы подготовить или проверить данные в тесте."""
    async with SessionFactory() as session:
        yield session


Headers = dict[str, str]
LoginAs = Callable[..., Awaitable[Headers]]


@pytest.fixture
def login_as(client: AsyncClient) -> LoginAs:
    """Регистрирует пользователя, подтверждает код и возвращает заголовки с токеном."""

    async def _login(
        phone: str = "+79120000001", name: str = "Полина Исупова", role: str = "user"
    ) -> Headers:
        response = await client.post(
            "/api/auth/register", json={"name": name, "phone": phone, "city": "Москва"}
        )
        assert response.status_code == 200, response.text
        if role != "user":
            async with SessionFactory() as session:
                await set_role(session, phone, role)
        response = await client.post("/api/auth/verify", json={"phone": phone, "code": TEST_CODE})
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['accessToken']}"}

    return _login
