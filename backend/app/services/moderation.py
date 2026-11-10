"""Панель модератора: все метки, смена статусов, активные SOS, счётчики."""

from collections.abc import Iterable, Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Incident, SosSignal, User
from app.models.incident import STATUS_CLOSED, STATUS_HIDDEN, STATUS_IN_PROGRESS, STATUS_NEW
from app.models.sos import SOS_ACTIVE, SOS_RESOLVED
from app.schemas.moderation import ModerationIncidentUpdateIn, StatsOut
from app.services import incidents as incidents_service
from app.services import sos as sos_service


async def set_incident_status(
    session: AsyncSession, moderator: User, incident_id: int, data: ModerationIncidentUpdateIn
) -> Incident:
    incident = await incidents_service.get_incident(session, incident_id)
    now = datetime.now(UTC)
    if incident.reacted_at is None and data.status != STATUS_NEW:
        incident.reacted_at = now

    if data.status == STATUS_CLOSED:
        if incident.status != STATUS_CLOSED:
            incidents_service.close(incident)
    else:
        incident.status = data.status
        incident.closed_at = None  # переоткрыли или скрыли

    if "moderator_note" in data.model_fields_set:
        incident.moderator_note = data.moderator_note or None
    await session.commit()
    return await incidents_service.get_incident(session, incident.id)


async def list_sos(
    session: AsyncSession, statuses: Iterable[str] | None, limit: int
) -> Sequence[SosSignal]:
    query = (
        sos_service.with_details(select(SosSignal))
        .order_by(SosSignal.created_at.desc(), SosSignal.id.desc())
        .limit(limit)
    )
    if statuses:
        query = query.where(SosSignal.status.in_(set(statuses)))
    return (await session.scalars(query)).all()


async def resolve_sos(session: AsyncSession, sos_id: int) -> SosSignal:
    """Модератор отмечает, что помощь пришла."""
    sos = await sos_service.get_sos(session, sos_id)
    await sos_service.finish(session, sos, SOS_RESOLVED)
    return await sos_service.get_sos(session, sos.id)


async def stats(session: AsyncSession) -> StatsOut:
    rows = await session.execute(select(Incident.status, func.count()).group_by(Incident.status))
    counts: dict[str, int] = dict(rows.all())
    active_sos = await session.scalar(
        select(func.count()).select_from(SosSignal).where(SosSignal.status == SOS_ACTIVE)
    )
    now = datetime.now(UTC)
    day = timedelta(hours=24)
    return StatsOut(
        new_incidents=counts.get(STATUS_NEW, 0),
        in_progress=counts.get(STATUS_IN_PROGRESS, 0),
        hidden=counts.get(STATUS_HIDDEN, 0),
        active_sos=active_sos or 0,
        avg_reaction_minutes=await _avg_reaction(session, now - day, now),
        avg_reaction_minutes_prev=await _avg_reaction(session, now - 2 * day, now - day),
    )


async def _avg_reaction(session: AsyncSession, start: datetime, end: datetime) -> float | None:
    """Среднее (reacted_at − created_at) в минутах по реакциям, случившимся в [start, end)."""
    seconds = await session.scalar(
        select(func.avg(func.extract("epoch", Incident.reacted_at - Incident.created_at))).where(
            Incident.reacted_at >= start, Incident.reacted_at < end
        )
    )
    return None if seconds is None else round(float(seconds) / 60, 1)
