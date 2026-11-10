"""Настройки приложения. Читаются из переменных окружения и файла backend/.env."""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-secret-change-me-in-production-0123456789"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Безопасный город API"
    environment: str = "dev"  # dev | test | prod
    debug: bool = False

    # PostgreSQL (см. docker-compose.yml в корне репозитория)
    database_url: str = "postgresql+asyncpg://safe_city:safe_city@localhost:5433/safe_city"

    # Фронтенд ходит на API с другого origin — разрешаем CORS.
    # В dev дополнительно пускаем любой порт localhost: Vite берёт :5174, если :5173 занят.
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # JWT
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    # Мок SMS: в dev/test код подтверждения всегда этот
    sms_mock_code: str = "0000"

    # Коды входа: длина в prod и лимиты против перебора и SMS-бомбинга
    auth_code_length: int = 6
    auth_code_resend_seconds: int = 60  # новый код на номер — не чаще
    auth_codes_per_phone_per_hour: int = 5
    auth_codes_per_ip_per_hour: int = 30
    auth_failed_attempts_per_hour: int = 10  # неверных кодов на номер за час, по всем кодам

    # Куда складываем загруженные фото
    media_dir: str = "media"
    # Предел тела запроса (4 фото по 5 МБ + запас); дублируйте его на прокси
    max_request_bytes: int = 25 * 1024 * 1024

    @model_validator(mode="after")
    def _check_prod_secret(self) -> "Settings":
        if self.environment == "prod" and (
            self.jwt_secret == DEV_JWT_SECRET or len(self.jwt_secret) < 32
        ):
            raise ValueError("В prod задайте JWT_SECRET длиной не меньше 32 символов")
        return self

    @property
    def is_dev(self) -> bool:
        return self.environment in ("dev", "test")


@lru_cache
def get_settings() -> Settings:
    return Settings()
