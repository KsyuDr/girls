"""Статичные справочники приложения (решение 11 в agents/02-decisions.md).

Меняются вместе с кодом, в базе не хранятся. Отдаются целиком через GET /api/reference.
"""

from functools import cache

from app.reference.catalog import (
    CITIES,
    INCIDENT_TYPE_IDS,
    INCIDENT_TYPES,
    MAP_CATEGORIES,
    MAX_CONTACTS,
    REPORT_NEXT_STEPS,
    SOS_WAITING_TIPS,
)
from app.reference.guides import GUIDES
from app.reference.services import SERVICES
from app.schemas.reference import ReferenceOut

__all__ = ["CITIES", "INCIDENT_TYPE_IDS", "MAX_CONTACTS", "get_reference"]


@cache
def get_reference() -> ReferenceOut:
    return ReferenceOut(
        services=SERVICES,
        guides=GUIDES,
        incident_types=INCIDENT_TYPES,
        map_categories=MAP_CATEGORIES,
        cities=CITIES,
        sos_waiting_tips=SOS_WAITING_TIPS,
        report_next_steps=REPORT_NEXT_STEPS,
        max_contacts=MAX_CONTACTS,
    )
