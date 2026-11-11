from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import ModeratorUser, OptionalUser
from app.core.errors import ForbiddenError
from app.db.session import SessionDep
from app.schemas.alert import AlertCreateIn, AlertLevel, AlertOut, AlertUpdateIn
from app.services import alerts as service

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut], summary="Лента оповещений, новые сверху")
async def list_alerts(
    session: SessionDep,
    viewer: OptionalUser,
    level: Annotated[
        list[AlertLevel] | None,
        Query(description="Можно несколько: ?level=critical&level=warning"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    include_unpublished: Annotated[
        bool,
        Query(
            alias="includeUnpublished",
            description="Модератору — вместе со снятыми с публикации",
        ),
    ] = False,
) -> list[AlertOut]:
    if include_unpublished and not (viewer and viewer.is_moderator):
        raise ForbiddenError("Снятые оповещения видит только модератор")
    alerts = await service.list_alerts(
        session, levels=level, include_unpublished=include_unpublished, limit=limit
    )
    return [AlertOut.model_validate(a) for a in alerts]


@router.get("/{alert_id}", response_model=AlertOut, summary="Одно оповещение")
async def get_alert(alert_id: int, session: SessionDep, viewer: OptionalUser) -> AlertOut:
    return AlertOut.model_validate(await service.get_alert(session, alert_id, viewer))


@router.post(
    "",
    response_model=AlertOut,
    status_code=status.HTTP_201_CREATED,
    summary="Опубликовать оповещение (модератор)",
)
async def create_alert(
    data: AlertCreateIn, moderator: ModeratorUser, session: SessionDep
) -> AlertOut:
    return AlertOut.model_validate(await service.create_alert(session, moderator, data))


@router.patch(
    "/{alert_id}",
    response_model=AlertOut,
    summary="Изменить или снять с публикации (модератор)",
)
async def update_alert(
    alert_id: int, data: AlertUpdateIn, moderator: ModeratorUser, session: SessionDep
) -> AlertOut:
    return AlertOut.model_validate(await service.update_alert(session, moderator, alert_id, data))
