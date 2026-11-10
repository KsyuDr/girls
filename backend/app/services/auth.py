"""Регистрация и вход по номеру телефона и одноразовому коду.

Все операции с кодами одного номера идут по очереди (транзакционная advisory-блокировка
PostgreSQL на номер): так счётчики попыток и лимиты нельзя обойти параллельными запросами.
"""

from datetime import UTC, datetime, timedelta
from math import ceil

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.config import get_settings
from app.core.errors import BadRequestError, ConflictError, NotFoundError, TooManyRequestsError
from app.core.security import generate_code, hash_code, verify_code
from app.models import AuthCode, User
from app.schemas.auth import RegisterIn
from app.services import sms

CODE_TTL = timedelta(minutes=5)
MAX_ATTEMPTS = 5  # неверных попыток на один код
HOUR = timedelta(hours=1)


async def get_user_by_phone(session: AsyncSession, phone: str) -> User | None:
    return await session.scalar(select(User).where(User.phone == phone))


async def register(session: AsyncSession, data: RegisterIn, ip: str | None = None) -> None:
    """Отправляет код. Пользователь появится (или заполнится) только после ввода кода."""
    await _lock_phone(session, data.phone)
    user = await get_user_by_phone(session, data.phone)
    if user is not None and user.phone_verified_at is not None:
        raise ConflictError("Этот номер уже зарегистрирован — войдите по номеру телефона")
    await _issue_code(session, data.phone, ip, profile=data)
    await session.commit()


async def login(session: AsyncSession, phone: str, ip: str | None = None) -> None:
    await _lock_phone(session, phone)
    if await get_user_by_phone(session, phone) is None:
        raise NotFoundError("Пользователь с таким номером не найден — зарегистрируйтесь")
    await _issue_code(session, phone, ip)
    await session.commit()


async def verify(session: AsyncSession, phone: str, code: str) -> User:
    """Проверяет код. При успехе помечает номер подтверждённым и возвращает пользователя."""
    now = datetime.now(UTC)
    await _lock_phone(session, phone)
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
    if await _failed_attempts_last_hour(session, phone) >= (
        get_settings().auth_failed_attempts_per_hour
    ):
        raise TooManyRequestsError(
            "Слишком много неверных кодов — попробуйте через час", retry_after=3600
        )

    if not verify_code(phone, code, auth_code.code_hash):
        auth_code.attempts += 1
        await session.commit()
        raise BadRequestError("Неверный код")

    auth_code.used_at = now
    user = await get_user_by_phone(session, phone)
    if user is None:
        if auth_code.name is None:  # код входа, а пользователя за это время удалили
            raise NotFoundError("Пользователь не найден — зарегистрируйтесь")
        user = User(phone=phone)
        session.add(user)
    if user.phone_verified_at is None:
        if auth_code.name is not None:
            user.name = auth_code.name
            user.city = auth_code.city
            user.geolocation_enabled = auth_code.geolocation_enabled
        user.phone_verified_at = now
    await session.commit()
    await session.refresh(user)
    return user


async def _lock_phone(session: AsyncSession, phone: str) -> None:
    """Блокировка номера до конца транзакции (снимается при commit/rollback)."""
    await session.execute(select(func.pg_advisory_xact_lock(func.hashtext(f"auth:{phone}"))))


def _db_now() -> ColumnElement[datetime]:
    """Часы базы: created_at ставит PostgreSQL, сравниваем по тем же часам (без рассинхрона)."""
    return func.clock_timestamp()


async def _failed_attempts_last_hour(session: AsyncSession, phone: str) -> int:
    total = await session.scalar(
        select(func.coalesce(func.sum(AuthCode.attempts), 0)).where(
            AuthCode.phone == phone, AuthCode.created_at >= _db_now() - HOUR
        )
    )
    return int(total or 0)


async def _check_issue_limits(session: AsyncSession, phone: str, ip: str | None) -> None:
    """Не чаще раза в минуту и не больше N кодов в час на номер и на IP."""
    settings = get_settings()
    elapsed = await session.scalar(
        select(func.extract("epoch", _db_now() - func.max(AuthCode.created_at))).where(
            AuthCode.phone == phone
        )
    )
    if elapsed is not None:
        wait = settings.auth_code_resend_seconds - float(elapsed)
        if wait > 0:
            seconds = ceil(wait)
            raise TooManyRequestsError(
                f"Код уже отправлен. Новый можно запросить через {seconds} с",
                retry_after=seconds,
            )

    per_phone = await _codes_last_hour(session, AuthCode.phone == phone)
    if per_phone >= settings.auth_codes_per_phone_per_hour:
        raise TooManyRequestsError(
            "Слишком много кодов на этот номер — попробуйте через час", retry_after=3600
        )
    if ip is not None:
        per_ip = await _codes_last_hour(session, AuthCode.ip == ip)
        if per_ip >= settings.auth_codes_per_ip_per_hour:
            raise TooManyRequestsError(
                "Слишком много запросов кода с этого устройства — попробуйте позже",
                retry_after=3600,
            )


async def _codes_last_hour(session: AsyncSession, condition: ColumnElement[bool]) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(AuthCode)
        .where(condition, AuthCode.created_at >= _db_now() - HOUR)
    )
    return int(count or 0)


async def _issue_code(
    session: AsyncSession, phone: str, ip: str | None, profile: RegisterIn | None = None
) -> None:
    """Гасит прежние коды номера, создаёт новый и отправляет его по SMS."""
    settings = get_settings()
    now = datetime.now(UTC)
    await _check_issue_limits(session, phone, ip)
    code = settings.sms_mock_code if settings.is_dev else generate_code(settings.auth_code_length)

    await session.execute(
        update(AuthCode)
        .where(AuthCode.phone == phone, AuthCode.used_at.is_(None))
        .values(used_at=now)
    )
    session.add(
        AuthCode(
            phone=phone,
            code_hash=hash_code(phone, code),
            expires_at=now + CODE_TTL,
            ip=ip,
            name=profile.name.strip() if profile else None,
            city=profile.city.strip() if profile else None,
            geolocation_enabled=profile.geolocation_enabled if profile else None,
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
