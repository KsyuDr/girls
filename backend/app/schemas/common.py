"""Общие схемы Pydantic.

Фронтенд (src/services/api.js) работает с camelCase, а в Python пишем snake_case.
Все схемы наследуются от CamelModel: в JSON поля уходят в camelCase,
а на вход принимаются оба варианта.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class HealthOut(CamelModel):
    status: str
    database: str
    version: str
