"""Настройки приложения. Читаются из переменных окружения и файла backend/.env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Безопасный город API"
    environment: str = "dev"  # dev | test | prod
    debug: bool = True

    # PostgreSQL (см. docker-compose.yml в корне репозитория)
    database_url: str = "postgresql+asyncpg://safe_city:safe_city@localhost:5433/safe_city"

    # Фронтенд (Vite) ходит на API с другого порта — разрешаем CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    # Мок SMS: в dev-режиме код подтверждения всегда этот
    sms_mock_code: str = "0000"

    # Куда складываем загруженные фото
    media_dir: str = "media"


@lru_cache
def get_settings() -> Settings:
    return Settings()
