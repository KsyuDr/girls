from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import ConfigDict, Field, model_validator

from app.schemas.common import CamelModel
from app.schemas.incident import PersonOut

SosStatus = Literal["active", "cancelled", "resolved"]
DeliveryStatus = Literal["sending", "delivered", "failed"]


class SosCreateIn(CamelModel):
    """Всё необязательно: без координат берём последнее известное место пользователя."""

    model_config = ConfigDict(str_strip_whitespace=True)

    lat: Annotated[float, Field(ge=-90, le=90)] | None = None
    lng: Annotated[float, Field(ge=-180, le=180)] | None = None
    address: Annotated[str, Field(max_length=200)] | None = None
    accuracy_meters: Annotated[float, Field(ge=0, le=100_000)] | None = None

    @model_validator(mode="after")
    def _both_coordinates(self) -> Self:
        if (self.lat is None) != (self.lng is None):
            raise ValueError("Передайте обе координаты: lat и lng")
        return self


class SosLocationIn(CamelModel):
    """Досылка координат браузера к уже отправленному сигналу."""

    model_config = ConfigDict(str_strip_whitespace=True)

    lat: Annotated[float, Field(ge=-90, le=90)]
    lng: Annotated[float, Field(ge=-180, le=180)]
    address: Annotated[str, Field(max_length=200)] | None = None
    accuracy_meters: Annotated[float, Field(ge=0, le=100_000)] | None = None


class DeliveryOut(CamelModel):
    id: int
    contact_id: int | None  # null, если контакт потом удалили
    name: str
    relation: str
    phone: str
    channel: Literal["sms", "sms_push"]
    status: DeliveryStatus


class SosOut(CamelModel):
    id: int
    status: SosStatus
    lat: float | None
    lng: float | None
    address: str | None
    accuracy_meters: float | None
    started_at: datetime
    ended_at: datetime | None
    notified_contacts: list[DeliveryOut]


class ModerationSosOut(SosOut):
    user: PersonOut  # модератору — кто подал сигнал, с телефоном


class IncomingSosOut(CamelModel):
    """Активный SOS, который пришёл мне: мой номер есть в экстренных контактах отправителя."""

    id: int
    status: SosStatus
    lat: float | None
    lng: float | None
    address: str | None
    accuracy_meters: float | None
    started_at: datetime
    sender: PersonOut  # полное имя и телефон: близкому нужно перезвонить
    relation: str  # кем я записан у отправителя («Мама»)
