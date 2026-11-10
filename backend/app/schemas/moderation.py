from typing import Annotated

from pydantic import ConfigDict, Field

from app.schemas.common import CamelModel
from app.schemas.incident import IncidentStatus


class ModerationIncidentUpdateIn(CamelModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    status: IncidentStatus
    # Пустая строка стирает заметку; поле не передано — заметка не меняется
    moderator_note: Annotated[str, Field(max_length=1000)] | None = None


class StatsOut(CamelModel):
    new_incidents: int
    in_progress: int
    hidden: int
    active_sos: int
    # Среднее время от создания метки до первой реакции модератора, минуты.
    # Последние 24 часа и предыдущие 24 часа (для «−1 мин к вчерашнему дню»); null — нет данных.
    avg_reaction_minutes: float | None
    avg_reaction_minutes_prev: float | None
