from typing import Annotated

from fastapi import APIRouter, File, Query, Response, UploadFile, status

from app.api.deps import CurrentUser, OptionalUser
from app.core.errors import BadRequestError, UnauthorizedError
from app.db.session import SessionDep
from app.schemas.incident import (
    IncidentCreateIn,
    IncidentOut,
    IncidentType,
    IncidentUpdateIn,
    PhotoOut,
    PublicStatus,
    ResponseCreateIn,
    ResponseOut,
)
from app.services import incidents as service

router = APIRouter(prefix="/incidents", tags=["incidents"])

Lat = Annotated[float | None, Query(ge=-90, le=90, description="Широта пользователя")]
Lng = Annotated[float | None, Query(ge=-180, le=180, description="Долгота пользователя")]


@router.get(
    "",
    response_model=list[IncidentOut],
    summary="Метки на карте (скрытые модератором не отдаются)",
)
async def list_incidents(
    session: SessionDep,
    viewer: OptionalUser,
    type: Annotated[
        list[IncidentType] | None, Query(description="Можно несколько: ?type=fire&type=gas")
    ] = None,
    status_: Annotated[list[PublicStatus] | None, Query(alias="status")] = None,
    lat: Lat = None,
    lng: Lng = None,
    radius: Annotated[
        int | None, Query(ge=1, le=50_000, description="Радиус в метрах, нужны lat и lng")
    ] = None,
    mine: Annotated[bool, Query(description="Только мои метки, включая скрытые")] = False,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[IncidentOut]:
    if (lat is None) != (lng is None):
        raise BadRequestError("Передайте обе координаты: lat и lng")
    if radius is not None and lat is None:
        raise BadRequestError("Для radius нужны координаты lat и lng")
    if mine and viewer is None:
        raise UnauthorizedError()
    rows = await service.list_incidents(
        session,
        viewer,
        types=type,
        statuses=status_,
        lat=lat,
        lng=lng,
        radius=radius,
        mine=mine,
        limit=limit,
    )
    return [service.incident_out(incident, viewer, distance) for incident, distance in rows]


@router.get("/{incident_id}", response_model=IncidentOut, summary="Одна метка")
async def get_incident(
    incident_id: int,
    session: SessionDep,
    viewer: OptionalUser,
    lat: Lat = None,
    lng: Lng = None,
) -> IncidentOut:
    if (lat is None) != (lng is None):
        raise BadRequestError("Передайте обе координаты: lat и lng")
    incident = await service.get_visible_incident(session, incident_id, viewer)
    distance = None
    if lat is not None and lng is not None:
        distance = service.distance_meters(lat, lng, incident.lat, incident.lng)
    return service.incident_out(incident, viewer, distance)


@router.post(
    "",
    response_model=IncidentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Сообщить о происшествии (поставить метку)",
)
async def create_incident(
    data: IncidentCreateIn, user: CurrentUser, session: SessionDep
) -> IncidentOut:
    incident = await service.create_incident(session, user, data)
    return service.incident_out(incident, user)


@router.post(
    "/{incident_id}/photos",
    response_model=list[PhotoOut],
    status_code=status.HTTP_201_CREATED,
    summary="Приложить фото (до 4 на метку, JPG/PNG/WebP, до 5 МБ)",
)
async def upload_photos(
    incident_id: int,
    files: Annotated[list[UploadFile], File(description="Поле files, можно несколько")],
    user: CurrentUser,
    session: SessionDep,
) -> list[PhotoOut]:
    photos = await service.add_photos(session, user, incident_id, files)
    return [service.photo_out(p) for p in photos]


@router.patch(
    "/{incident_id}",
    response_model=IncidentOut,
    summary="Автор правит описание/адрес или закрывает метку",
)
async def update_incident(
    incident_id: int, data: IncidentUpdateIn, user: CurrentUser, session: SessionDep
) -> IncidentOut:
    incident = await service.update_incident(session, user, incident_id, data)
    return service.incident_out(incident, user)


@router.post(
    "/{incident_id}/responses",
    response_model=ResponseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Откликнуться «Помогу» / «Нашёл»",
)
async def respond(
    incident_id: int,
    user: CurrentUser,
    session: SessionDep,
    data: ResponseCreateIn | None = None,
) -> ResponseOut:
    response = await service.respond(session, user, incident_id, data or ResponseCreateIn())
    return service.response_out(response)


@router.delete(
    "/{incident_id}/responses/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Отменить свой отклик",
)
async def cancel_response(incident_id: int, user: CurrentUser, session: SessionDep) -> Response:
    await service.cancel_response(session, user, incident_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
