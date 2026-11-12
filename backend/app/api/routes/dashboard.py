from fastapi import APIRouter

from app.api.deps import OptionalUser
from app.db.session import SessionDep
from app.reference import get_reference
from app.schemas.alert import AlertOut
from app.schemas.auth import UserOut
from app.schemas.contact import ContactOut
from app.schemas.dashboard import DashboardOut, ModerationDashboardOut
from app.services import alerts as alerts_service
from app.services import contacts as contacts_service
from app.services import incidents as incidents_service
from app.services import moderation as moderation_service
from app.services import places as places_service
from app.services import sos as sos_service

router = APIRouter(tags=["dashboard"])

DASHBOARD_INCIDENTS = 100
DASHBOARD_ALERTS = 50


@router.get(
    "/dashboard",
    response_model=DashboardOut,
    summary="Стартовые данные приложения одним запросом (токен необязателен)",
)
async def dashboard(session: SessionDep, viewer: OptionalUser) -> DashboardOut:
    lat = viewer.last_lat if viewer else None
    lng = viewer.last_lng if viewer else None
    if lat is None or lng is None:
        lat = lng = None

    alerts = await alerts_service.list_alerts(session, limit=DASHBOARD_ALERTS)
    places = await places_service.list_places(session, None, lat, lng)
    incidents = await incidents_service.list_incidents(
        session, viewer, lat=lat, lng=lng, limit=DASHBOARD_INCIDENTS
    )

    contacts: list[ContactOut] = []
    active_sos = None
    incoming_sos = []
    moderation = None
    if viewer is not None:
        contacts = [
            ContactOut.model_validate(c)
            for c in await contacts_service.list_contacts(session, viewer.id)
        ]
        sos = await sos_service.get_active(session, viewer.id)
        active_sos = sos_service.sos_out(sos) if sos else None
        incoming_sos = await sos_service.list_incoming(session, viewer)
        if viewer.is_moderator:
            all_incidents = await incidents_service.list_incidents(
                session, viewer, include_hidden=True, limit=200
            )
            signals = await moderation_service.list_sos(session, ["active"], 100)
            moderation = ModerationDashboardOut(
                incidents=[
                    incidents_service.moderation_incident_out(i, viewer) for i, _ in all_incidents
                ],
                active_sos=[sos_service.moderation_sos_out(s) for s in signals],
                stats=await moderation_service.stats(session),
                alerts=[
                    AlertOut.model_validate(a)
                    for a in await alerts_service.list_alerts(
                        session, include_unpublished=True, limit=DASHBOARD_ALERTS
                    )
                ],
            )

    return DashboardOut(
        is_authenticated=viewer is not None,
        user=UserOut.model_validate(viewer) if viewer else None,
        reference=get_reference(),
        alerts=[AlertOut.model_validate(a) for a in alerts],
        places=places,
        incidents=[incidents_service.incident_out(i, viewer, d) for i, d in incidents],
        contacts=contacts,
        active_sos=active_sos,
        incoming_sos=incoming_sos,
        moderation=moderation,
    )
