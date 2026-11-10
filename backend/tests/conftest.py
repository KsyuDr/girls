"""Общие фикстуры тестов.

Тесты работают с отдельной базой safe_city_test (создаётся docker/init-test-db.sql).
Перед запуском: `docker compose up -d db` в корне репозитория.
"""

import os

# Всегда тестовая база (фикстуры делают drop_all!). Переопределяется через TEST_DATABASE_URL.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://safe_city:safe_city@localhost:5433/safe_city_test",
)
os.environ["ENVIRONMENT"] = "test"

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.db.session import engine
from app.main import app
from app.models import Base


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
