from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import Id, ModeratorUser
from app.db.session import SessionDep
from app.schemas.incident import IncidentStatus, IncidentType, ModerationIncidentOut
from app.schemas.moderation import ModerationIncidentUpdateIn, StatsOut
from app.schemas.sos import ModerationSosOut, SosStatus
from app.services import incidents as incidents_service
from app.services import moderation as service
from app.services import sos as sos_service

router = APIRouter(prefix="/moderation", tags=["moderation"])


@router.get(
    "/incidents",
    response_model=list[ModerationIncidentOut],
    summary="Все метки, включая скрытые; с автором даже у анонимных",
)
async def list_incidents(
    moderator: ModeratorUser,
    session: SessionDep,
    status: Annotated[list[IncidentStatus] | None, Query(description="Можно несколько")] = None,
    type: Annotated[list[IncidentType] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[ModerationIncidentOut]:
    rows = await incidents_service.list_incidents(
        session, moderator, types=type, statuses=status, include_hidden=True, limit=limit
    )
    return [incidents_service.moderation_incident_out(i, moderator) for i, _ in rows]


@router.patch(
    "/incidents/{incident_id}",
    response_model=ModerationIncidentOut,
    summary="Сменить статус метки (в том числе скрыть спам) и оставить заметку",
)
async def update_incident(
    incident_id: Id,
    data: ModerationIncidentUpdateIn,
    moderator: ModeratorUser,
    session: SessionDep,
) -> ModerationIncidentOut:
    incident = await service.set_incident_status(session, moderator, incident_id, data)
    return incidents_service.moderation_incident_out(incident, moderator)


@router.get(
    "/sos",
    response_model=list[ModerationSosOut],
    summary="SOS-сигналы, по умолчанию только активные",
)
async def list_sos(
    moderator: ModeratorUser,
    session: SessionDep,
    status: Annotated[list[SosStatus] | None, Query(description="По умолчанию active")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[ModerationSosOut]:
    signals = await service.list_sos(session, status or ["active"], limit)
    return [sos_service.moderation_sos_out(s) for s in signals]


@router.post(
    "/sos/{sos_id}/resolve",
    response_model=ModerationSosOut,
    summary="Отметить, что помощь пришла",
)
async def resolve_sos(
    sos_id: Id, moderator: ModeratorUser, session: SessionDep
) -> ModerationSosOut:
    return sos_service.moderation_sos_out(await service.resolve_sos(session, sos_id))


@router.get("/stats", response_model=StatsOut, summary="Счётчики для панели")
async def stats(moderator: ModeratorUser, session: SessionDep) -> StatsOut:
    return await service.stats(session)
