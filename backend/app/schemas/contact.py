from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, ConfigDict, Field

from app.core.phone import normalize_phone
from app.schemas.common import CamelModel, InputModel

DEFAULT_RELATION = "Близкий"

NotifyMethod = Literal["sms", "sms_push"]
ContactName = Annotated[str, Field(min_length=2, max_length=100)]
ContactPhone = Annotated[str, AfterValidator(normalize_phone)]
Relation = Annotated[str, Field(max_length=50)]


class _ContactIn(InputModel):
    # Пробелы по краям обрезаются до проверки длины
    model_config = ConfigDict(str_strip_whitespace=True)


class ContactCreateIn(_ContactIn):
    name: ContactName
    relation: Relation = DEFAULT_RELATION
    phone: ContactPhone
    receives_sos: bool = True
    notify_method: NotifyMethod = "sms_push"


class ContactUpdateIn(_ContactIn):
    """Любые поля контакта. null для поля игнорируется (как в PATCH /users/me)."""

    name: ContactName | None = None
    relation: Relation | None = None
    phone: ContactPhone | None = None
    receives_sos: bool | None = None
    notify_method: NotifyMethod | None = None


class ContactOut(CamelModel):
    id: int
    name: str
    relation: str
    phone: str
    receives_sos: bool
    notify_method: NotifyMethod
    position: int
    created_at: datetime
