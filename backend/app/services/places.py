"""Справочные точки карты: выборка с расстоянием до пользователя и загрузка сид-данных."""

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import distance_meters
from app.models import Place
from app.reference.places_seed import PlaceSeed
from app.schemas.place import PlaceOut


async def list_places(
    session: AsyncSession,
    categories: Iterable[str] | None = None,
    lat: float | None = None,
    lng: float | None = None,
) -> list[PlaceOut]:
    """Точки карты. С координатами — с полем distanceMeters и от ближней к дальней."""
    query = select(Place).order_by(Place.id)
    if categories:
        query = query.where(Place.category.in_(set(categories)))
    places = [PlaceOut.model_validate(p) for p in await session.scalars(query)]

    if lat is not None and lng is not None:
        for place in places:
            place.distance_meters = distance_meters(lat, lng, place.lat, place.lng)
        places.sort(key=lambda p: (p.distance_meters, p.id))
    return places


async def seed_places(session: AsyncSession, seeds: Iterable[PlaceSeed]) -> int:
    """Добавляет точки, которых ещё нет (по названию и адресу). Возвращает, сколько добавлено."""
    existing = {tuple(row) for row in await session.execute(select(Place.title, Place.address))}
    new = [Place(**s) for s in seeds if (s["title"], s["address"]) not in existing]
    session.add_all(new)
    await session.commit()
    return len(new)
