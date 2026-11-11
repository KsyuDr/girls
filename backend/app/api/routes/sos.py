from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser
from app.db.session import SessionDep
from app.schemas.sos import SosCreateIn, SosLocationIn, SosOut
from app.services import sos as service

router = APIRouter(prefix="/sos", tags=["sos"])


@router.post(
    "",
    response_model=SosOut,
    status_code=status.HTTP_201_CREATED,
    summary="Отправить SOS близким (повторно — обновить местоположение активного сигнала)",
    responses={200: {"description": "Сигнал уже был активен — обновлено местоположение"}},
)
async def send_sos(
    user: CurrentUser, session: SessionDep, response: Response, data: SosCreateIn | None = None
) -> SosOut:
    sos, created = await service.send_sos(session, user, data or SosCreateIn())
    if not created:
        response.status_code = status.HTTP_200_OK
    return service.sos_out(sos)


@router.get("/active", response_model=SosOut | None, summary="Мой активный сигнал или null")
async def get_active(user: CurrentUser, session: SessionDep) -> SosOut | None:
    sos = await service.get_active(session, user.id)
    return service.sos_out(sos) if sos else None


# Фронт вызывает /sos/active/cancel, если не знает id — поэтому этот путь объявлен раньше
@router.post("/active/cancel", response_model=SosOut, summary="Отменить мой активный сигнал")
async def cancel_active(user: CurrentUser, session: SessionDep) -> SosOut:
    return service.sos_out(await service.cancel_sos(session, user, None))


@router.post("/{sos_id}/cancel", response_model=SosOut, summary="Отменить сигнал по id")
async def cancel_sos(sos_id: int, user: CurrentUser, session: SessionDep) -> SosOut:
    return service.sos_out(await service.cancel_sos(session, user, sos_id))


@router.get("/{sos_id}", response_model=SosOut, summary="Мой сигнал по id (и завершённый)")
async def get_sos(sos_id: int, user: CurrentUser, session: SessionDep) -> SosOut:
    return service.sos_out(await service.get_own_sos(session, user, sos_id))


@router.post(
    "/{sos_id}/location",
    response_model=SosOut,
    summary="Дослать координаты к этому сигналу (новый сигнал не создаёт)",
    responses={409: {"description": "Сигнал уже завершён"}},
)
async def update_location(
    sos_id: int, data: SosLocationIn, user: CurrentUser, session: SessionDep
) -> SosOut:
    return service.sos_out(await service.update_location(session, user, sos_id, data))
