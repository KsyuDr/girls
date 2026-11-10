"""Настройки приложения. Читаются из переменных окружения и файла backend/.env."""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-secret-change-me-in-production-0123456789"


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
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    # Мок SMS: в dev-режиме код подтверждения всегда этот
    sms_mock_code: str = "0000"

    # Куда складываем загруженные фото
    media_dir: str = "media"

    @model_validator(mode="after")
    def _check_prod_secret(self) -> "Settings":
        if self.environment == "prod" and (
            self.jwt_secret == DEV_JWT_SECRET or len(self.jwt_secret) < 32
        ):
            raise ValueError("В prod задайте JWT_SECRET длиной не меньше 32 символов")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
