"""Зависимости FastAPI: текущий пользователь, необязательный вход и роль модератора."""

from typing import Annotated

from fastapi import Depends, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import SessionDep
from app.models import User

_bearer = HTTPBearer(auto_error=False, description="Токен из POST /api/auth/verify")


async def _user_from_token(session: SessionDep, token: str) -> User:
    user_id = decode_access_token(token)
    if user_id is None:
        raise UnauthorizedError("Сессия истекла — войдите снова")
    user = await session.get(User, user_id)
    if user is None:
        raise UnauthorizedError("Пользователь не найден — войдите снова")
    return user


async def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise UnauthorizedError()
    return await _user_from_token(session, credentials.credentials)


async def get_optional_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User | None:
    """Для публичных эндпоинтов: без токена — гость, с неверным токеном — 401
    (фронт поймёт, что надо войти заново, а не будет молча показывать гостевые данные)."""
    if credentials is None:
        return None
    return await _user_from_token(session, credentials.credentials)


async def get_moderator(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_moderator:
        raise ForbiddenError("Доступно только модераторам")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
ModeratorUser = Annotated[User, Depends(get_moderator)]

# id в пути: PostgreSQL integer (int4). Больше 2^31−1 asyncpg не передаст в запрос — было бы 500
MAX_ID = 2**31 - 1
Id = Annotated[int, Path(le=MAX_ID)]
