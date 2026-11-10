from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import AfterValidator, ConfigDict, Field, model_validator

from app.reference import INCIDENT_TYPE_IDS
from app.schemas.common import CamelModel

IncidentStatus = Literal["new", "in_progress", "closed", "hidden"]
PublicStatus = Literal["new", "in_progress", "closed"]
ResponseStatus = Literal["active", "cancelled", "done"]


def _check_type(value: str) -> str:
    if value not in INCIDENT_TYPE_IDS:
        raise ValueError("Неизвестный тип метки, см. incidentTypes в GET /api/reference")
    return value


IncidentType = Annotated[str, AfterValidator(_check_type)]
Description = Annotated[str, Field(min_length=3, max_length=2000)]
Address = Annotated[str, Field(min_length=3, max_length=200)]
Lat = Annotated[float, Field(ge=-90, le=90)]
Lng = Annotated[float, Field(ge=-180, le=180)]


class _In(CamelModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class IncidentCreateIn(_In):
    type: IncidentType
    description: Description
    address: Address
    # Если координат нет — берём последнее известное место пользователя (lastLat/lastLng)
    lat: Lat | None = None
    lng: Lng | None = None
    is_anonymous: bool = False

    @model_validator(mode="after")
    def _both_coordinates(self) -> Self:
        if (self.lat is None) != (self.lng is None):
            raise ValueError("Передайте обе координаты: lat и lng")
        return self


class IncidentUpdateIn(_In):
    """Автор может поправить описание и адрес или закрыть метку."""

    description: Description | None = None
    address: Address | None = None
    status: Literal["closed"] | None = None


class ResponseCreateIn(_In):
    message: Annotated[str, Field(max_length=500)] | None = None


class PersonOut(CamelModel):
    id: int
    name: str  # «Полина И.» — фамилия сокращена
    # Телефон видит только автор метки (у откликнувшихся) и модератор
    phone: str | None = None


class PhotoOut(CamelModel):
    id: int
    url: str  # путь от корня сервера: /media/incidents/12/….jpg
    content_type: str
    size_bytes: int


class ResponseOut(CamelModel):
    id: int
    incident_id: int
    user: PersonOut
    message: str | None
    status: ResponseStatus
    created_at: datetime


class IncidentOut(CamelModel):
    id: int
    type: str
    description: str
    address: str
    lat: float
    lng: float
    is_anonymous: bool
    status: IncidentStatus
    author: PersonOut | None  # null у анонимной метки
    is_mine: bool
    photos: list[PhotoOut]
    responses_count: int  # активные отклики
    my_response: ResponseOut | None  # мой активный отклик, если я вошёл и откликался
    responses: list[ResponseOut] | None  # список откликов — только автору
    distance_meters: int | None = None
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None


class ModerationIncidentOut(IncidentOut):
    """Модератор видит автора даже у анонимной метки и свою заметку."""

    moderator_note: str | None
