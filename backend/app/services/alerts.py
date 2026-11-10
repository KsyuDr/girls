"""Лента оповещений: читают все, публикует и правит модератор."""

from collections.abc import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models import Alert, User
from app.models.alert import DEFAULT_LOCATION
from app.schemas.alert import AlertCreateIn, AlertUpdateIn


async def list_alerts(
    session: AsyncSession,
    *,
    levels: Iterable[str] | None = None,
    include_unpublished: bool = False,
    limit: int = 50,
) -> Sequence[Alert]:
    query = select(Alert).order_by(Alert.created_at.desc(), Alert.id.desc()).limit(limit)
    if not include_unpublished:
        query = query.where(Alert.is_published.is_(True))
    if levels:
        query = query.where(Alert.level.in_(set(levels)))
    return (await session.scalars(query)).all()


async def get_alert(session: AsyncSession, alert_id: int, viewer: User | None) -> Alert:
    """Снятое с публикации оповещение видит только модератор."""
    alert = await session.get(Alert, alert_id)
    if alert is None or (not alert.is_published and not (viewer and viewer.is_moderator)):
        raise NotFoundError("Оповещение не найдено")
    return alert


async def create_alert(session: AsyncSession, author: User | None, data: AlertCreateIn) -> Alert:
    alert = Alert(
        **data.model_dump(exclude={"location_label"}),
        location_label=data.location_label or DEFAULT_LOCATION,
        author_id=author.id if author else None,
    )
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    return alert


async def update_alert(
    session: AsyncSession, moderator: User, alert_id: int, data: AlertUpdateIn
) -> Alert:
    alert = await get_alert(session, alert_id, moderator)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(alert, field, value)
    await session.commit()
    await session.refresh(alert)
    return alert


async def seed_alerts(session: AsyncSession, alerts: Iterable[AlertCreateIn]) -> int:
    """Добавляет демо-оповещения, которых ещё нет (по заголовку). Возвращает, сколько добавлено."""
    existing = set(await session.scalars(select(Alert.title)))
    added = 0
    for data in alerts:
        if data.title not in existing:
            await create_alert(session, None, data)
            added += 1
    return added
