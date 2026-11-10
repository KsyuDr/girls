from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.db.session import SessionDep
from app.schemas.auth import NotificationsIn, UserOut, UserUpdateIn

router = APIRouter(tags=["users"])

# Эти поля в базе обязательные: null от клиента просто игнорируем
_NOT_NULLABLE = {"name", "city", "geolocation_enabled", "push_notifications_enabled"}


@router.get("/users/me", response_model=UserOut, summary="Профиль текущего пользователя")
async def get_me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/users/me", response_model=UserOut, summary="Изменить профиль и настройки")
async def update_me(data: UserUpdateIn, user: CurrentUser, session: SessionDep) -> UserOut:
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field in _NOT_NULLABLE:
            continue
        setattr(user, field, value.strip() if isinstance(value, str) else value)
    await session.commit()
    await session.refresh(user)
    return UserOut.model_validate(user)


@router.patch(
    "/user/notifications",
    response_model=UserOut,
    summary="Вкл/выкл push-уведомления (путь как в frontend api.js)",
)
async def update_notifications(
    data: NotificationsIn, user: CurrentUser, session: SessionDep
) -> UserOut:
    user.push_notifications_enabled = data.push_notifications_enabled
    await session.commit()
    await session.refresh(user)
    return UserOut.model_validate(user)
