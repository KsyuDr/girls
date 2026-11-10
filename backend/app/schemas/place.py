from app.schemas.common import CamelModel
from app.schemas.reference import PlaceCategory


class PlaceOut(CamelModel):
    id: int
    title: str
    category: PlaceCategory
    address: str
    lat: float
    lng: float
    hours_label: str | None
    phone: str | None
    is_open: bool
    # Заполняется, только если в запросе переданы lat и lng
    distance_meters: int | None = None
