from typing import Annotated

from fastapi import APIRouter, Query

from app.core.errors import BadRequestError
from app.db.session import SessionDep
from app.reference import get_reference
from app.schemas.place import PlaceOut
from app.schemas.reference import PlaceCategory, ReferenceOut
from app.services import places as places_service

router = APIRouter(tags=["reference"])

Lat = Annotated[float | None, Query(ge=-90, le=90, description="Широта пользователя")]
Lng = Annotated[float | None, Query(ge=-180, le=180, description="Долгота пользователя")]


@router.get(
    "/reference",
    response_model=ReferenceOut,
    summary="Справочники: службы, памятки, типы меток, категории карты, города",
)
async def reference() -> ReferenceOut:
    return get_reference()


@router.get(
    "/places",
    response_model=list[PlaceOut],
    summary="Справочные точки карты; с lat и lng — расстояние и сортировка по близости",
)
async def list_places(
    session: SessionDep,
    category: Annotated[
        list[PlaceCategory] | None,
        Query(description="Можно несколько: ?category=hospital&category=police"),
    ] = None,
    lat: Lat = None,
    lng: Lng = None,
) -> list[PlaceOut]:
    if (lat is None) != (lng is None):
        raise BadRequestError("Передайте обе координаты: lat и lng")
    return await places_service.list_places(session, category, lat, lng)
