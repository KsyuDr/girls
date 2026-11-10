from fastapi import APIRouter, Request

from app.core.security import create_access_token
from app.db.session import SessionDep
from app.schemas.auth import CodeSentOut, LoginIn, RegisterIn, TokenOut, UserOut, VerifyIn
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

LIMITS = (
    "Новый код на номер — не чаще раза в минуту и не больше 5 в час; "
    "с одного IP — не больше 30 в час. Иначе 429 с заголовком Retry-After."
)


def client_ip(request: Request) -> str | None:
    # За прокси запускайте uvicorn с --proxy-headers, тогда здесь будет адрес клиента
    return request.client.host if request.client else None


@router.post(
    "/register",
    response_model=CodeSentOut,
    summary="Шаг 1 регистрации: данные пользователя, отправка кода по SMS",
    description=LIMITS,
)
async def register(data: RegisterIn, request: Request, session: SessionDep) -> CodeSentOut:
    await auth_service.register(session, data, client_ip(request))
    return CodeSentOut(phone=data.phone)


@router.post(
    "/login", response_model=CodeSentOut, summary="Вход: отправка кода по SMS", description=LIMITS
)
async def login(data: LoginIn, request: Request, session: SessionDep) -> CodeSentOut:
    await auth_service.login(session, data.phone, client_ip(request))
    return CodeSentOut(phone=data.phone)


@router.post(
    "/verify",
    response_model=TokenOut,
    summary="Шаг 2: проверка кода, выдача токена",
    description="До 5 неверных попыток на код и до 10 неверных кодов на номер за час.",
)
async def verify(data: VerifyIn, session: SessionDep) -> TokenOut:
    user = await auth_service.verify(session, data.phone, data.code)
    return TokenOut(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )
