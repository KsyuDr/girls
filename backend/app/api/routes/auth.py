from fastapi import APIRouter

from app.core.security import create_access_token
from app.db.session import SessionDep
from app.schemas.auth import CodeSentOut, LoginIn, RegisterIn, TokenOut, UserOut, VerifyIn
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=CodeSentOut,
    summary="Шаг 1 регистрации: данные пользователя, отправка кода по SMS",
)
async def register(data: RegisterIn, session: SessionDep) -> CodeSentOut:
    await auth_service.register(session, data)
    return CodeSentOut(phone=data.phone)


@router.post("/login", response_model=CodeSentOut, summary="Вход: отправка кода по SMS")
async def login(data: LoginIn, session: SessionDep) -> CodeSentOut:
    await auth_service.login(session, data.phone)
    return CodeSentOut(phone=data.phone)


@router.post("/verify", response_model=TokenOut, summary="Шаг 2: проверка кода, выдача токена")
async def verify(data: VerifyIn, session: SessionDep) -> TokenOut:
    user = await auth_service.verify(session, data.phone, data.code)
    return TokenOut(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )
