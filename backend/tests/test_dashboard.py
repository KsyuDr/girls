from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.reference.alerts_seed import DEMO_ALERTS
from app.reference.places_seed import MOSCOW_PLACES
from app.services.alerts import seed_alerts
from app.services.places import seed_places
from tests.conftest import LoginAs

FIRE = {
    "type": "fire",
    "description": "Задымление в подъезде",
    "address": "ул. Никольская, 10",
    "lat": 55.757,
    "lng": 37.623,
}


async def seed(db: AsyncSession) -> None:
    await seed_places(db, MOSCOW_PLACES)
    await seed_alerts(db, DEMO_ALERTS)


async def test_dashboard_for_guest(client: AsyncClient, db: AsyncSession) -> None:
    await seed(db)

    response = await client.get("/api/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["isAuthenticated"] is False
    assert body["user"] is None
    assert body["contacts"] == []
    assert body["activeSos"] is None
    assert body["moderation"] is None
    assert body["reference"]["maxContacts"] == 5
    assert len(body["alerts"]) == len(DEMO_ALERTS)
    assert len(body["places"]) == len(MOSCOW_PLACES)
    assert all(p["distanceMeters"] is None for p in body["places"])
    assert body["incidents"] == []


async def test_dashboard_for_resident(
    client: AsyncClient, login_as: LoginAs, db: AsyncSession
) -> None:
    await seed(db)
    headers = await login_as()
    await client.patch(
        "/api/users/me", headers=headers, json={"lastLat": 55.7539, "lastLng": 37.6208}
    )
    await client.post(
        "/api/contacts",
        headers=headers,
        json={"name": "Ольга Мартынова", "relation": "Мама", "phone": "+79122041833"},
    )
    await client.post("/api/incidents", headers=headers, json=FIRE)
    await client.post("/api/sos", headers=headers)

    body = (await client.get("/api/dashboard", headers=headers)).json()

    assert body["isAuthenticated"] is True
    assert body["user"]["name"] == "Полина Исупова"
    assert [c["relation"] for c in body["contacts"]] == ["Мама"]
    assert body["activeSos"]["status"] == "active"
    assert body["incidents"][0]["isMine"] is True
    assert body["incidents"][0]["distanceMeters"] > 0
    distances = [p["distanceMeters"] for p in body["places"]]
    assert distances == sorted(distances)  # с местоположением — от ближних к дальним
    assert body["moderation"] is None


async def test_dashboard_for_moderator(client: AsyncClient, login_as: LoginAs) -> None:
    resident = await login_as(phone="+79120000001")
    mod = await login_as(phone="+79120000099", name="Анна Смирнова", role="moderator")
    incident = (await client.post("/api/incidents", headers=resident, json=FIRE)).json()
    await client.patch(
        f"/api/moderation/incidents/{incident['id']}", headers=mod, json={"status": "hidden"}
    )
    await client.post("/api/sos", headers=resident)

    body = (await client.get("/api/dashboard", headers=mod)).json()

    assert body["incidents"] == []  # на карте скрытой метки нет
    moderation = body["moderation"]
    assert [i["id"] for i in moderation["incidents"]] == [incident["id"]]
    assert moderation["incidents"][0]["author"]["phone"] == "+79120000001"
    assert len(moderation["activeSos"]) == 1
    assert moderation["stats"]["hidden"] == 1


async def test_dashboard_rejects_bad_token(client: AsyncClient) -> None:
    response = await client.get("/api/dashboard", headers={"Authorization": "Bearer expired"})

    assert response.status_code == 401
