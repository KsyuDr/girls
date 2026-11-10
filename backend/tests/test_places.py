from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Place
from app.reference.places_seed import MOSCOW_PLACES, PlaceSeed
from app.schemas.reference import PlaceCategory
from app.services.places import seed_places

# Красная площадь — «мы здесь»
HERE = {"lat": 55.7539, "lng": 37.6208}


def place(title: str, category: PlaceCategory, lat: float, lng: float) -> PlaceSeed:
    return {
        "title": title,
        "category": category,
        "address": f"адрес: {title}",
        "lat": lat,
        "lng": lng,
        "hours_label": "Круглосуточно",
        "phone": "112",
        "is_open": True,
    }


FAR_HOSPITAL = place("Далёкая больница", "hospital", 55.80, 37.62)  # около 5 км
NEAR_POLICE = place("Ближняя полиция", "police", 55.7545, 37.6208)  # около 70 м
MIDDLE_SHELTER = place("Пункт обогрева", "shelter", 55.7630, 37.6208)  # около 1 км


async def add_places(db: AsyncSession) -> None:
    await seed_places(db, [FAR_HOSPITAL, NEAR_POLICE, MIDDLE_SHELTER])


async def test_places_empty(client: AsyncClient) -> None:
    response = await client.get("/api/places")

    assert response.status_code == 200
    assert response.json() == []


async def test_places_public_without_coordinates(client: AsyncClient, db: AsyncSession) -> None:
    await add_places(db)

    response = await client.get("/api/places")

    assert response.status_code == 200
    body = response.json()
    assert [p["title"] for p in body] == ["Далёкая больница", "Ближняя полиция", "Пункт обогрева"]
    first = body[0]
    assert set(first) == {
        "id",
        "title",
        "category",
        "address",
        "lat",
        "lng",
        "hoursLabel",
        "phone",
        "isOpen",
        "distanceMeters",
    }
    assert first["distanceMeters"] is None
    assert first["hoursLabel"] == "Круглосуточно"


async def test_places_sorted_by_distance(client: AsyncClient, db: AsyncSession) -> None:
    await add_places(db)

    response = await client.get("/api/places", params=HERE)

    assert response.status_code == 200
    body = response.json()
    assert [p["title"] for p in body] == ["Ближняя полиция", "Пункт обогрева", "Далёкая больница"]
    distances = [p["distanceMeters"] for p in body]
    assert 60 <= distances[0] <= 80
    assert 950 <= distances[1] <= 1050
    assert 5000 <= distances[2] <= 5300


async def test_places_filter_by_category(client: AsyncClient, db: AsyncSession) -> None:
    await add_places(db)

    one = await client.get("/api/places", params={"category": "hospital"})
    several = await client.get(
        "/api/places", params=[("category", "police"), ("category", "shelter")]
    )

    assert [p["title"] for p in one.json()] == ["Далёкая больница"]
    assert {p["category"] for p in several.json()} == {"police", "shelter"}
    assert len(several.json()) == 2


async def test_places_filter_and_distance_together(client: AsyncClient, db: AsyncSession) -> None:
    await add_places(db)

    response = await client.get("/api/places", params={**HERE, "category": "shelter"})

    body = response.json()
    assert len(body) == 1
    assert body[0]["distanceMeters"] is not None


async def test_places_unknown_category(client: AsyncClient) -> None:
    response = await client.get("/api/places", params={"category": "casino"})

    assert response.status_code == 422


async def test_places_needs_both_coordinates(client: AsyncClient) -> None:
    only_lat = await client.get("/api/places", params={"lat": 55.75})
    only_lng = await client.get("/api/places", params={"lng": 37.62})

    assert only_lat.status_code == 400
    assert "lat и lng" in only_lat.json()["detail"]
    assert only_lng.status_code == 400


async def test_places_coordinates_out_of_range(client: AsyncClient) -> None:
    bad_lat = await client.get("/api/places", params={"lat": 91, "lng": 37})
    bad_lng = await client.get("/api/places", params={"lat": 55, "lng": 181})
    not_number = await client.get("/api/places", params={"lat": "север", "lng": 37})

    assert bad_lat.status_code == 422
    assert bad_lng.status_code == 422
    assert not_number.status_code == 422


async def test_seed_moscow_is_idempotent(client: AsyncClient, db: AsyncSession) -> None:
    first = await seed_places(db, MOSCOW_PLACES)
    second = await seed_places(db, MOSCOW_PLACES)

    assert first == len(MOSCOW_PLACES)
    assert second == 0
    assert await db.scalar(select(func.count()).select_from(Place)) == len(MOSCOW_PLACES)

    body = (await client.get("/api/places")).json()
    assert {p["category"] for p in body} == {"shelter", "hospital", "police", "danger"}
    # Все точки — в пределах Москвы
    for p in body:
        assert 55.5 < p["lat"] < 56.0, p["title"]
        assert 37.3 < p["lng"] < 37.9, p["title"]
    assert any(not p["isOpen"] for p in body)


async def test_seed_adds_only_missing(db: AsyncSession) -> None:
    await seed_places(db, MOSCOW_PLACES[:3])

    added = await seed_places(db, MOSCOW_PLACES)

    assert added == len(MOSCOW_PLACES) - 3
