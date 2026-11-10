"""Зависимости FastAPI: текущий пользователь и проверка роли модератора."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import SessionDep
from app.models import User

_bearer = HTTPBearer(auto_error=False, description="Токен из POST /api/auth/verify")


async def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise UnauthorizedError()
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise UnauthorizedError("Сессия истекла — войдите снова")
    user = await session.get(User, user_id)
    if user is None:
        raise UnauthorizedError("Пользователь не найден — войдите снова")
    return user


async def get_moderator(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_moderator:
        raise ForbiddenError("Доступно только модераторам")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
ModeratorUser = Annotated[User, Depends(get_moderator)]
