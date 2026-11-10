"""Регистрация и вход по номеру телефона и одноразовому коду."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import BadRequestError, ConflictError, NotFoundError, TooManyRequestsError
from app.core.security import generate_code, hash_code, verify_code
from app.models import AuthCode, User
from app.schemas.auth import RegisterIn
from app.services import sms

CODE_TTL = timedelta(minutes=5)
MAX_ATTEMPTS = 5


async def get_user_by_phone(session: AsyncSession, phone: str) -> User | None:
    return await session.scalar(select(User).where(User.phone == phone))


async def register(session: AsyncSession, data: RegisterIn) -> None:
    """Создаёт пользователя (или обновляет неподтверждённого) и отправляет код."""
    user = await get_user_by_phone(session, data.phone)
    if user is not None and user.phone_verified_at is not None:
        raise ConflictError("Этот номер уже зарегистрирован — войдите по номеру телефона")

    if user is None:
        user = User(phone=data.phone)
        session.add(user)
    user.name = data.name.strip()
    user.city = data.city.strip()
    user.geolocation_enabled = data.geolocation_enabled

    await _issue_code(session, data.phone)
    await session.commit()


async def login(session: AsyncSession, phone: str) -> None:
    if await get_user_by_phone(session, phone) is None:
        raise NotFoundError("Пользователь с таким номером не найден — зарегистрируйтесь")
    await _issue_code(session, phone)
    await session.commit()


async def verify(session: AsyncSession, phone: str, code: str) -> User:
    """Проверяет код. При успехе помечает номер подтверждённым и возвращает пользователя."""
    now = datetime.now(UTC)
    auth_code = await session.scalar(
        select(AuthCode)
        .where(AuthCode.phone == phone, AuthCode.used_at.is_(None))
        .order_by(AuthCode.id.desc())
        .limit(1)
    )
    if auth_code is None or auth_code.expires_at <= now:
        raise BadRequestError("Код устарел — запросите новый")
    if auth_code.attempts >= MAX_ATTEMPTS:
        raise TooManyRequestsError("Слишком много попыток — запросите новый код")

    if not verify_code(phone, code, auth_code.code_hash):
        auth_code.attempts += 1
        await session.commit()
        raise BadRequestError("Неверный код")

    user = await get_user_by_phone(session, phone)
    if user is None:  # код был, а пользователя удалили — маловероятно, но обработаем
        raise NotFoundError("Пользователь не найден")

    auth_code.used_at = now
    if user.phone_verified_at is None:
        user.phone_verified_at = now
    await session.commit()
    await session.refresh(user)
    return user


async def _issue_code(session: AsyncSession, phone: str) -> None:
    """Гасит прежние коды номера, создаёт новый и отправляет его по SMS."""
    settings = get_settings()
    code = settings.sms_mock_code if settings.environment in ("dev", "test") else generate_code()

    await session.execute(
        update(AuthCode)
        .where(AuthCode.phone == phone, AuthCode.used_at.is_(None))
        .values(used_at=datetime.now(UTC))
    )
    session.add(
        AuthCode(
            phone=phone,
            code_hash=hash_code(phone, code),
            expires_at=datetime.now(UTC) + CODE_TTL,
        )
    )
    await sms.send_code(phone, code)


async def set_role(session: AsyncSession, phone: str, role: str) -> User:
    user = await get_user_by_phone(session, phone)
    if user is None:
        raise NotFoundError("Пользователь с таким номером не найден")
    user.role = role
    await session.commit()
    return user
