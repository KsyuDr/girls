from app.schemas.alert import AlertOut
from app.schemas.auth import UserOut
from app.schemas.common import CamelModel
from app.schemas.contact import ContactOut
from app.schemas.incident import IncidentOut, ModerationIncidentOut
from app.schemas.moderation import StatsOut
from app.schemas.place import PlaceOut
from app.schemas.reference import ReferenceOut
from app.schemas.sos import ModerationSosOut, SosOut


class ModerationDashboardOut(CamelModel):
    incidents: list[ModerationIncidentOut]
    active_sos: list[ModerationSosOut]
    stats: StatsOut
    alerts: list[AlertOut]  # все оповещения, включая снятые с публикации


class DashboardOut(CamelModel):
    """Всё, что нужно фронту при старте, одним запросом.

    Гостю — публичные данные; с токеном — ещё профиль, контакты и активный SOS;
    модератору — ещё данные панели. Расстояния — от последнего местоположения пользователя.
    """

    is_authenticated: bool
    user: UserOut | None
    reference: ReferenceOut
    alerts: list[AlertOut]
    places: list[PlaceOut]
    incidents: list[IncidentOut]
    contacts: list[ContactOut]
    active_sos: SosOut | None
    moderation: ModerationDashboardOut | None
