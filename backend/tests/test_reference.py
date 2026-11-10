from httpx import AsyncClient

from app.reference import CITIES, INCIDENT_TYPE_IDS, MAX_CONTACTS
from tests.conftest import LoginAs


async def test_reference_is_public_and_complete(client: AsyncClient) -> None:
    response = await client.get("/api/reference")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "services",
        "guides",
        "incidentTypes",
        "mapCategories",
        "cities",
        "sosWaitingTips",
        "reportNextSteps",
        "maxContacts",
    }
    assert body["maxContacts"] == MAX_CONTACTS == 5
    assert body["cities"] == CITIES
    assert "Москва" in body["cities"]
    assert len(body["sosWaitingTips"]) == 3
    assert len(body["reportNextSteps"]) == 3


async def test_reference_services(client: AsyncClient) -> None:
    services = (await client.get("/api/reference")).json()["services"]

    assert [s["number"] for s in services] == ["112", "101", "102", "103", "104"]
    first = services[0]
    # camelCase, иконка и цвета — часть справочника
    assert first["shortName"] == "Спасатели"
    assert first["icon"] == "siren"
    assert first["bgColor"].startswith("#")
    assert first["showOnMobileHome"] is True


async def test_reference_guides(client: AsyncClient) -> None:
    guides = (await client.get("/api/reference")).json()["guides"]

    assert [g["id"] for g in guides] == ["fire", "accident", "flood", "first-aid", "gas", "terror"]
    for guide in guides:
        assert guide["steps"], guide["id"]
        assert guide["donts"], guide["id"]
        assert guide["readMinutes"] >= 1
        assert guide["emergencyNumber"] in {"101", "102", "103", "104", "112"}


async def test_reference_incident_types_cover_data_model(client: AsyncClient) -> None:
    types = (await client.get("/api/reference")).json()["incidentTypes"]

    ids = {t["id"] for t in types}
    assert ids == INCIDENT_TYPE_IDS
    assert ids == {
        "fire",
        "accident",
        "threat",
        "flood",
        "gas",
        "other",
        "help_needed",
        "lost",
        "found",
    }
    # Форма «Сообщить о происшествии» показывает только группу danger — как в макете
    danger = [t["id"] for t in types if t["group"] == "danger"]
    assert danger == ["fire", "accident", "threat", "flood", "gas", "other"]


async def test_reference_map_categories(client: AsyncClient) -> None:
    categories = (await client.get("/api/reference")).json()["mapCategories"]

    assert [c["id"] for c in categories] == ["danger", "shelter", "hospital", "police"]
    assert all(c["dotColor"].startswith("#") for c in categories)


async def test_register_accepts_only_reference_cities(client: AsyncClient) -> None:
    unknown = await client.post(
        "/api/auth/register",
        json={"name": "Полина", "phone": "+79123456789", "city": "Атлантида"},
    )
    padded = await client.post(
        "/api/auth/register",
        json={"name": "Полина", "phone": "+79123456789", "city": " Казань "},
    )

    assert unknown.status_code == 422
    assert "Выберите город из списка" in unknown.text
    assert padded.status_code == 200


async def test_update_profile_rejects_unknown_city(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    response = await client.patch("/api/users/me", headers=headers, json={"city": "Атлантида"})

    assert response.status_code == 422
