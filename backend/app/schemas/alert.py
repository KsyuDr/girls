from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, ConfigDict, Field

from app.schemas.common import CamelModel

AlertLevel = Literal["critical", "warning", "info"]
Title = Annotated[str, Field(min_length=3, max_length=120)]
Subtitle = Annotated[str, Field(max_length=200)]
Description = Annotated[str, Field(min_length=3, max_length=5000)]
Label = Annotated[str, Field(max_length=100)]


def _drop_empty(items: list[str]) -> list[str]:
    return [item for item in items if item]


# До 10 пунктов «что делать»; пустые строки выбрасываем
Checklist = Annotated[
    list[Annotated[str, Field(max_length=300)]],
    Field(max_length=10),
    AfterValidator(_drop_empty),
]


class _AlertIn(CamelModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class AlertCreateIn(_AlertIn):
    title: Title
    subtitle: Subtitle | None = None
    description: Description
    level: AlertLevel = "warning"
    location_label: Label | None = None  # по умолчанию «Весь город»
    source_label: Label | None = None
    actions_checklist: Annotated[Checklist, Field(default_factory=list)]
    is_published: bool = True


class AlertUpdateIn(_AlertIn):
    """Модератор правит оповещение или снимает его с публикации.

    null у обязательных полей игнорируется; subtitle и sourceLabel null или "" стирает,
    locationLabel — возвращает «Весь город».
    """

    title: Title | None = None
    subtitle: Subtitle | None = None
    description: Description | None = None
    level: AlertLevel | None = None
    location_label: Label | None = None
    source_label: Label | None = None
    actions_checklist: Checklist | None = None
    is_published: bool | None = None


class AlertOut(CamelModel):
    id: int
    title: str
    subtitle: str | None
    description: str
    level: AlertLevel
    location_label: str
    source_label: str | None
    actions_checklist: list[str]
    is_published: bool
    created_at: datetime
    updated_at: datetime
