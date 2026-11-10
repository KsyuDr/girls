"""JWT-токены и хеширование одноразовых кодов."""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int | None:
    """Возвращает id пользователя или None, если токен неверный или просрочен."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def generate_code(length: int = 4) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))


def hash_code(phone: str, code: str) -> str:
    """HMAC от телефона и кода: в базе не лежит сам код."""
    key = get_settings().jwt_secret.encode()
    return hmac.new(key, f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def verify_code(phone: str, code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_code(phone, code), code_hash)
