from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, Field

from app.core.phone import normalize_phone
from app.schemas.common import CamelModel

Phone = Annotated[str, AfterValidator(normalize_phone)]
Name = Annotated[str, Field(min_length=2, max_length=100)]
City = Annotated[str, Field(min_length=2, max_length=60)]


class RegisterIn(CamelModel):
    name: Name
    phone: Phone
    city: City
    geolocation_enabled: bool = True


class LoginIn(CamelModel):
    phone: Phone


class VerifyIn(CamelModel):
    phone: Phone
    code: Annotated[str, Field(pattern=r"^\d{4,6}$")]


class CodeSentOut(CamelModel):
    step: int = 2
    sms_sent: bool = True
    phone: str


class UserOut(CamelModel):
    id: int
    phone: str
    name: str
    city: str
    role: str
    geolocation_enabled: bool
    push_notifications_enabled: bool
    last_lat: float | None
    last_lng: float | None
    last_address: str | None
    phone_verified_at: datetime | None
    created_at: datetime


class TokenOut(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdateIn(CamelModel):
    name: Name | None = None
    city: City | None = None
    geolocation_enabled: bool | None = None
    push_notifications_enabled: bool | None = None
    last_lat: Annotated[float, Field(ge=-90, le=90)] | None = None
    last_lng: Annotated[float, Field(ge=-180, le=180)] | None = None
    last_address: Annotated[str, Field(max_length=200)] | None = None


class NotificationsIn(CamelModel):
    push_notifications_enabled: bool
