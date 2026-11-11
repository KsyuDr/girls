"""Метки жителей: создание, выборка с фильтрами и радиусом, фото, отклики «Помогу»."""

from collections.abc import Iterable, Sequence
from datetime import UTC, datetime
from math import cos, radians

from fastapi import UploadFile
from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.core.errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.core.geo import EARTH_RADIUS_M, distance_meters, in_service_area
from app.models import Incident, IncidentPhoto, IncidentResponse, User
from app.models.incident import (
    RESPONSE_ACTIVE,
    RESPONSE_CANCELLED,
    RESPONSE_DONE,
    STATUS_CLOSED,
    STATUS_HIDDEN,
)
from app.schemas.incident import (
    IncidentCreateIn,
    IncidentOut,
    IncidentUpdateIn,
    ModerationIncidentOut,
    PersonOut,
    PhotoOut,
    ResponseCreateIn,
    ResponseOut,
)
from app.services import media

METERS_PER_DEGREE = 111_320


# ---------- чтение ----------


def with_details(query: Select) -> Select:
    """Сразу подгружаем автора, фото и отклики — ленивые загрузки в async запрещены."""
    return query.options(
        selectinload(Incident.author),
        selectinload(Incident.photos),
        selectinload(Incident.responses).selectinload(IncidentResponse.user),
    )


async def get_incident(
    session: AsyncSession, incident_id: int, *, for_update: bool = False
) -> Incident:
    """for_update — заблокировать строку метки до коммита: параллельные изменения одной метки
    (фото сверх лимита, правка автора против скрытия модератором) идут по очереди."""
    query = select(Incident).where(Incident.id == incident_id)
    if for_update:
        query = query.with_for_update()
    # populate_existing: после изменений в этой же сессии перечитываем связи и поля из базы
    incident = await session.scalar(with_details(query).execution_options(populate_existing=True))
    if incident is None:
        raise NotFoundError("Метка не найдена")
    return incident


async def get_visible_incident(
    session: AsyncSession, incident_id: int, viewer: User | None, *, for_update: bool = False
) -> Incident:
    """Скрытую метку видят только автор и модератор, остальным — 404."""
    incident = await get_incident(session, incident_id, for_update=for_update)
    if incident.status == STATUS_HIDDEN and not _is_author_or_moderator(incident, viewer):
        raise NotFoundError("Метка не найдена")
    return incident


async def list_incidents(
    session: AsyncSession,
    viewer: User | None,
    *,
    types: Iterable[str] | None = None,
    statuses: Iterable[str] | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius: int | None = None,
    mine: bool = False,
    include_hidden: bool = False,
    limit: int = 100,
) -> list[tuple[Incident, int | None]]:
    """Метки от новых к старым. С lat/lng — с расстоянием, с radius — только ближе radius метров."""
    query = with_details(select(Incident)).order_by(Incident.created_at.desc(), Incident.id.desc())
    if mine and viewer is not None:
        query = query.where(Incident.author_id == viewer.id)
    elif not include_hidden:
        query = query.where(Incident.status != STATUS_HIDDEN)
    if statuses:
        query = query.where(Incident.status.in_(set(statuses)))
    if types:
        query = query.where(Incident.type.in_(set(types)))

    has_point = lat is not None and lng is not None
    if has_point and radius is not None:
        # Квадрат отсекает дальние строки дёшево, точный круг — гаверсинусом; всё в SQL, с LIMIT
        d_lat = radius / METERS_PER_DEGREE
        d_lng = radius / (METERS_PER_DEGREE * max(cos(radians(lat)), 0.01))
        query = query.where(
            Incident.lat.between(lat - d_lat, lat + d_lat),
            Incident.lng.between(lng - d_lng, lng + d_lng),
            _sql_distance(lat, lng) <= radius,
        )
    query = query.limit(limit)

    return [
        (incident, distance_meters(lat, lng, incident.lat, incident.lng) if has_point else None)
        for incident in await session.scalars(query)
    ]


def _sql_distance(lat: float, lng: float) -> ColumnElement[float]:
    """Расстояние от метки до точки в метрах (гаверсинус) как SQL-выражение."""
    d_lat = func.radians(Incident.lat - lat)
    d_lng = func.radians(Incident.lng - lng)
    a = func.power(func.sin(d_lat / 2), 2) + cos(radians(lat)) * func.cos(
        func.radians(Incident.lat)
    ) * func.power(func.sin(d_lng / 2), 2)
    return 2 * EARTH_RADIUS_M * func.asin(func.least(1.0, func.sqrt(a)))


# ---------- запись ----------


async def create_incident(session: AsyncSession, user: User, data: IncidentCreateIn) -> Incident:
    lat, lng = data.lat, data.lng
    if lat is None or lng is None:
        if user.last_lat is None or user.last_lng is None:
            raise BadRequestError("Укажите место на карте или включите геолокацию")
        lat, lng = user.last_lat, user.last_lng
    if not in_service_area(lat, lng):
        raise BadRequestError(
            "Место метки за пределами России — проверьте точку на карте или геолокацию"
        )

    incident = Incident(
        author_id=user.id,
        type=data.type,
        description=data.description,
        address=data.address,
        lat=lat,
        lng=lng,
        is_anonymous=data.is_anonymous,
    )
    session.add(incident)
    await session.commit()
    return await get_incident(session, incident.id)


async def update_incident(
    session: AsyncSession, user: User, incident_id: int, data: IncidentUpdateIn
) -> Incident:
    incident = await _get_own_open(session, user, incident_id, for_update=True)
    for field in ("description", "address"):
        value = getattr(data, field)
        if value is not None:
            setattr(incident, field, value)
    if data.status == STATUS_CLOSED:
        close(incident)
    await session.commit()
    return await get_incident(session, incident.id)


def close(incident: Incident) -> None:
    """Закрывает метку; активные отклики считаем выполненными."""
    incident.status = STATUS_CLOSED
    incident.closed_at = datetime.now(UTC)
    for response in incident.responses:
        if response.status == RESPONSE_ACTIVE:
            response.status = RESPONSE_DONE


async def add_photos(
    session: AsyncSession, user: User, incident_id: int, uploads: Sequence[UploadFile]
) -> list[IncidentPhoto]:
    limit = media.MAX_PHOTOS_PER_INCIDENT
    await _get_own_open(session, user, incident_id)  # 404/403/409 — до чтения файлов
    if len(uploads) > limit:
        raise ConflictError(f"К метке можно приложить не больше {limit} фото")
    photos = [await media.read_photo(upload) for upload in uploads]  # сначала проверяем все

    # Свободные места считаем под блокировкой строки метки: параллельные загрузки
    # ждут друг друга и не превысят лимит
    incident = await _get_own_open(session, user, incident_id, for_update=True)
    free = limit - len(incident.photos)
    if len(photos) > free:
        await session.rollback()
        raise ConflictError(
            f"К метке можно приложить не больше {limit} фото, осталось мест: {free}"
        )

    saved: list[str] = []
    try:
        for photo in photos:
            path = await media.save_photo(incident.id, photo)
            saved.append(path)
            session.add(
                IncidentPhoto(
                    incident_id=incident.id,
                    file_path=path,
                    content_type=photo.content_type,
                    size_bytes=len(photo.data),
                )
            )
        await session.commit()
    except Exception:
        await session.rollback()
        await media.delete_files(saved)
        raise
    return (await get_incident(session, incident.id)).photos[-len(photos) :]


async def respond(
    session: AsyncSession, user: User, incident_id: int, data: ResponseCreateIn
) -> IncidentResponse:
    incident = await get_visible_incident(session, incident_id, user, for_update=True)
    if incident.author_id == user.id:
        raise BadRequestError("Нельзя откликнуться на свою метку")
    if incident.status in (STATUS_CLOSED, STATUS_HIDDEN):
        raise ConflictError("Метка закрыта — откликнуться уже нельзя")

    response = next((r for r in incident.responses if r.user_id == user.id), None)
    if response is not None and response.status == RESPONSE_ACTIVE:
        raise ConflictError("Вы уже откликнулись на эту метку")
    if response is None:
        response = IncidentResponse(incident_id=incident.id, user_id=user.id)
        session.add(response)
    response.status = RESPONSE_ACTIVE
    response.message = data.message or None
    try:
        await session.commit()
    except IntegrityError as exc:  # два одновременных отклика одного человека
        await session.rollback()
        raise ConflictError("Вы уже откликнулись на эту метку") from exc
    return await session.scalar(
        select(IncidentResponse)
        .options(selectinload(IncidentResponse.user))
        .where(IncidentResponse.id == response.id)
        .execution_options(populate_existing=True)
    )


async def cancel_response(session: AsyncSession, user: User, incident_id: int) -> None:
    incident = await get_visible_incident(session, incident_id, user, for_update=True)
    response = next(
        (r for r in incident.responses if r.user_id == user.id and r.status == RESPONSE_ACTIVE),
        None,
    )
    if response is None:
        raise NotFoundError("Вы не откликались на эту метку")
    response.status = RESPONSE_CANCELLED
    await session.commit()


async def _get_own_open(
    session: AsyncSession, user: User, incident_id: int, *, for_update: bool = False
) -> Incident:
    incident = await get_visible_incident(session, incident_id, user, for_update=for_update)
    if incident.author_id != user.id:
        raise ForbiddenError("Изменять метку может только её автор")
    if incident.status == STATUS_HIDDEN:
        raise ConflictError("Метка скрыта модератором")
    if incident.status == STATUS_CLOSED:
        raise ConflictError("Метка уже закрыта")
    return incident


def _is_author_or_moderator(incident: Incident, viewer: User | None) -> bool:
    return viewer is not None and (viewer.id == incident.author_id or viewer.is_moderator)


# ---------- в схемы ответа ----------


def short_name(name: str) -> str:
    """«Полина Исупова» → «Полина И.»: на карте полное имя ни к чему."""
    parts = name.split()
    return f"{parts[0]} {parts[1][0]}." if len(parts) >= 2 else name


def person_out(user: User, *, with_phone: bool = False, full_name: bool = False) -> PersonOut:
    return PersonOut(
        id=user.id,
        name=user.name if full_name else short_name(user.name),
        phone=user.phone if with_phone else None,
    )


def response_out(response: IncidentResponse, *, with_phone: bool = False) -> ResponseOut:
    return ResponseOut(
        id=response.id,
        incident_id=response.incident_id,
        user=person_out(response.user, with_phone=with_phone),
        message=response.message,
        status=response.status,
        created_at=response.created_at,
    )


def photo_out(photo: IncidentPhoto, *, signed: bool = False) -> PhotoOut:
    """signed — ссылка с подписью: по ней фото открывается и у скрытой метки.
    Такие ссылки получают только автор и модератор."""
    return PhotoOut(
        id=photo.id,
        url=media.media_url(photo.file_path, signed=signed),
        content_type=photo.content_type,
        size_bytes=photo.size_bytes,
    )


def _common_fields(incident: Incident, viewer: User | None, distance: int | None) -> dict:
    is_mine = viewer is not None and viewer.id == incident.author_id
    mine = next(
        (
            r
            for r in incident.responses
            if viewer is not None and r.user_id == viewer.id and r.status == RESPONSE_ACTIVE
        ),
        None,
    )
    return {
        "id": incident.id,
        "type": incident.type,
        "description": incident.description,
        "address": incident.address,
        "lat": incident.lat,
        "lng": incident.lng,
        "is_anonymous": incident.is_anonymous,
        "status": incident.status,
        "is_mine": is_mine,
        "photos": [
            photo_out(p, signed=_is_author_or_moderator(incident, viewer)) for p in incident.photos
        ],
        "responses_count": sum(r.status == RESPONSE_ACTIVE for r in incident.responses),
        "my_response": response_out(mine) if mine else None,
        # Автору — кто откликнулся и как связаться (телефон — только у действующих откликов)
        "responses": (
            [response_out(r, with_phone=r.status == RESPONSE_ACTIVE) for r in incident.responses]
            if is_mine
            else None
        ),
        "distance_meters": distance,
        "created_at": incident.created_at,
        "updated_at": incident.updated_at,
        "closed_at": incident.closed_at,
    }


def incident_out(
    incident: Incident, viewer: User | None, distance: int | None = None
) -> IncidentOut:
    fields = _common_fields(incident, viewer, distance)
    is_mine = fields["is_mine"]
    show_author = not incident.is_anonymous or is_mine
    fields["author"] = person_out(incident.author) if show_author else None
    return IncidentOut(**fields)


def moderation_incident_out(
    incident: Incident, moderator: User, distance: int | None = None
) -> ModerationIncidentOut:
    fields = _common_fields(incident, moderator, distance)
    fields["author"] = person_out(incident.author, with_phone=True, full_name=True)
    fields["responses"] = [response_out(r, with_phone=True) for r in incident.responses]
    return ModerationIncidentOut(**fields, moderator_note=incident.moderator_note)
