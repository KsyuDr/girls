"""Схемы статичных справочников (GET /api/reference).

Справочники — контент приложения, поэтому иконка и цвет здесь часть данных
(исключение из правила «оформление — забота фронта», см. agents/02-decisions.md, п. 10).
Иконки — имена из lucide-react, как во фронте.
"""

from typing import Literal

from app.schemas.common import CamelModel

PlaceCategory = Literal["shelter", "hospital", "police", "danger"]
IncidentGroup = Literal["danger", "help", "lost_found"]


class EmergencyService(CamelModel):
    id: str
    name: str
    short_name: str
    description: str
    number: str
    icon: str
    bg_color: str
    icon_color: str
    show_on_mobile_home: bool


class SafetyGuide(CamelModel):
    id: str
    title: str
    detail_title: str
    source: str  # «Памятка МЧС» — фронт сам собирает «Памятка МЧС · 5 шагов · 1 минута чтения»
    read_minutes: int
    icon: str
    emergency_number: str
    call_banner_title: str
    call_banner_subtitle: str
    show_on_mobile_preview: bool
    steps: list[str]
    donts: list[str]


class IncidentType(CamelModel):
    id: str
    label: str
    icon: str
    group: IncidentGroup  # danger — форма «Сообщить», help и lost_found — «люди помогают людям»
    hint: str  # кому звонить в первую очередь


class MapCategory(CamelModel):
    id: PlaceCategory
    label: str
    dot_color: str


class ReportNextStep(CamelModel):
    id: str
    title: str
    subtitle: str


class ReferenceOut(CamelModel):
    services: list[EmergencyService]
    guides: list[SafetyGuide]
    incident_types: list[IncidentType]
    map_categories: list[MapCategory]
    cities: list[str]
    sos_waiting_tips: list[str]
    report_next_steps: list[ReportNextStep]
    max_contacts: int
