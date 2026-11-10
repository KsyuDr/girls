import asyncio
import logging

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SosSignal
from tests.conftest import Headers, LoginAs

WHERE = {"lat": 55.7539, "lng": 37.6208, "address": "Красная площадь", "accuracyMeters": 8}


async def add_contact(
    client: AsyncClient, headers: Headers, phone: str, receives_sos: bool = True
) -> dict:
    response = await client.post(
        "/api/contacts",
        headers=headers,
        json={
            "name": f"Контакт {phone[-1]}",
            "relation": "Мама",
            "phone": phone,
            "receivesSos": receives_sos,
            "notifyMethod": "sms",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("POST", "/api/sos"),
        ("GET", "/api/sos/active"),
        ("POST", "/api/sos/1/cancel"),
        ("POST", "/api/sos/active/cancel"),
    ],
)
async def test_sos_requires_login(client: AsyncClient, method: str, url: str) -> None:
    assert (await client.request(method, url)).status_code == 401


async def test_send_sos_notifies_only_sos_contacts(
    client: AsyncClient, login_as: LoginAs, caplog: pytest.LogCaptureFixture
) -> None:
    headers = await login_as()
    mom = await add_contact(client, headers, "+79220000001")
    await add_contact(client, headers, "+79220000002", receives_sos=False)
    caplog.set_level(logging.WARNING, logger="safe_city.sms")

    response = await client.post("/api/sos", headers=headers, json=WHERE)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "active"
    assert (body["lat"], body["lng"]) == (55.7539, 37.6208)
    assert body["address"] == "Красная площадь"
    assert body["accuracyMeters"] == 8
    assert body["startedAt"]
    assert body["endedAt"] is None
    assert body["notifiedContacts"] == [
        {
            "id": body["notifiedContacts"][0]["id"],
            "contactId": mom["id"],
            "name": mom["name"],
            "relation": "Мама",
            "phone": "+79220000001",
            "channel": "sms",
            "status": "delivered",
        }
    ]
    assert "[SMS MOCK] +79220000001: SOS from user #1 at 55.75390,37.62080" in caplog.text
    assert "+79220000002" not in caplog.text


async def test_sos_updates_last_location(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    await client.post("/api/sos", headers=headers, json=WHERE)

    me = (await client.get("/api/users/me", headers=headers)).json()
    assert (me["lastLat"], me["lastLng"], me["lastAddress"]) == (
        55.7539,
        37.6208,
        "Красная площадь",
    )


async def test_sos_without_location_still_works(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    bare = await client.post("/api/sos", headers=headers)

    assert bare.status_code == 201
    assert bare.json()["lat"] is None
    assert bare.json()["notifiedContacts"] == []


async def test_sos_falls_back_to_last_location(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    await client.patch(
        "/api/users/me",
        headers=headers,
        json={"lastLat": 56.838, "lastLng": 60.597, "lastAddress": "ул. Малышева, 51"},
    )

    body = (await client.post("/api/sos", headers=headers, json={})).json()

    assert (body["lat"], body["lng"], body["address"]) == (56.838, 60.597, "ул. Малышева, 51")


async def test_sos_validation(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    one_coordinate = await client.post("/api/sos", headers=headers, json={"lat": 55.0})
    bad_lat = await client.post("/api/sos", headers=headers, json={"lat": 100, "lng": 37})
    bad_accuracy = await client.post(
        "/api/sos", headers=headers, json={**WHERE, "accuracyMeters": -1}
    )

    assert one_coordinate.status_code == 422
    assert bad_lat.status_code == 422
    assert bad_accuracy.status_code == 422


async def test_second_press_updates_active_sos(
    client: AsyncClient, login_as: LoginAs, db: AsyncSession
) -> None:
    headers = await login_as()
    first = (await client.post("/api/sos", headers=headers, json=WHERE)).json()

    second = await client.post(
        "/api/sos", headers=headers, json={"lat": 55.76, "lng": 37.63, "accuracyMeters": 20}
    )

    assert second.status_code == 200
    assert second.json()["id"] == first["id"]
    assert (second.json()["lat"], second.json()["accuracyMeters"]) == (55.76, 20)
    assert second.json()["address"] == "Красная площадь"
    assert await db.scalar(select(func.count()).select_from(SosSignal)) == 1


async def test_parallel_presses_create_one_sos(
    client: AsyncClient, login_as: LoginAs, db: AsyncSession
) -> None:
    headers = await login_as()

    responses = await asyncio.gather(
        *(client.post("/api/sos", headers=headers, json=WHERE) for _ in range(4))
    )

    assert all(r.status_code in (200, 201) for r in responses)
    assert len({r.json()["id"] for r in responses}) == 1
    assert await db.scalar(select(func.count()).select_from(SosSignal)) == 1


async def test_get_active(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    other = await login_as(phone="+79120000002", name="Иван Петров")

    none_yet = await client.get("/api/sos/active", headers=headers)
    sos = (await client.post("/api/sos", headers=headers, json=WHERE)).json()
    active = await client.get("/api/sos/active", headers=headers)
    others = await client.get("/api/sos/active", headers=other)

    assert none_yet.status_code == 200
    assert none_yet.json() is None
    assert active.json()["id"] == sos["id"]
    assert others.json() is None


async def test_cancel_sos(
    client: AsyncClient, login_as: LoginAs, caplog: pytest.LogCaptureFixture
) -> None:
    headers = await login_as()
    await add_contact(client, headers, "+79220000001")
    sos = (await client.post("/api/sos", headers=headers, json=WHERE)).json()
    caplog.set_level(logging.WARNING, logger="safe_city.sms")

    cancelled = await client.post(f"/api/sos/{sos['id']}/cancel", headers=headers)
    again = await client.post(f"/api/sos/{sos['id']}/cancel", headers=headers)
    active = await client.get("/api/sos/active", headers=headers)
    new_one = await client.post("/api/sos", headers=headers, json=WHERE)

    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["endedAt"] is not None
    assert "+79220000001: SOS from user #1 cancelled" in caplog.text
    assert again.status_code == 409
    assert active.json() is None
    assert new_one.status_code == 201
    assert new_one.json()["id"] != sos["id"]


async def test_cancel_active_without_id(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    nothing = await client.post("/api/sos/active/cancel", headers=headers)
    await client.post("/api/sos", headers=headers, json=WHERE)
    cancelled = await client.post("/api/sos/active/cancel", headers=headers)

    assert nothing.status_code == 404
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


async def test_cancel_foreign_or_missing(client: AsyncClient, login_as: LoginAs) -> None:
    polina = await login_as()
    ivan = await login_as(phone="+79120000002", name="Иван Петров")
    sos = (await client.post("/api/sos", headers=polina, json=WHERE)).json()

    foreign = await client.post(f"/api/sos/{sos['id']}/cancel", headers=ivan)
    missing = await client.post("/api/sos/999/cancel", headers=polina)

    assert foreign.status_code == 404
    assert missing.status_code == 404
    assert (await client.get("/api/sos/active", headers=polina)).json()["status"] == "active"


async def test_deleted_contact_stays_in_history(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    mom = await add_contact(client, headers, "+79220000001")
    await client.post("/api/sos", headers=headers, json=WHERE)

    await client.delete(f"/api/contacts/{mom['id']}", headers=headers)
    active = (await client.get("/api/sos/active", headers=headers)).json()

    assert active["notifiedContacts"][0]["contactId"] is None
    assert active["notifiedContacts"][0]["phone"] == "+79220000001"


async def test_cancel_and_resolve_at_once(
    client: AsyncClient, login_as: LoginAs, caplog: pytest.LogCaptureFixture
) -> None:
    """Отмена и «помощь пришла» одновременно: срабатывает одно, «отбой» — только при отмене."""
    headers = await login_as()
    moderator = await login_as(phone="+79120000099", name="Анна Смирнова", role="moderator")
    await add_contact(client, headers, "+79220000001")
    caplog.set_level(logging.WARNING, logger="safe_city.sms")

    for _ in range(5):
        sos = (await client.post("/api/sos", headers=headers, json=WHERE)).json()
        caplog.clear()

        cancel, resolve = await asyncio.gather(
            client.post(f"/api/sos/{sos['id']}/cancel", headers=headers),
            client.post(f"/api/moderation/sos/{sos['id']}/resolve", headers=moderator),
        )

        assert sorted([cancel.status_code, resolve.status_code]) == [200, 409]
        final = cancel.json()["status"] if cancel.status_code == 200 else "resolved"
        assert (resolve.status_code == 200) == (final == "resolved")
        assert ("cancelled" in caplog.text) == (cancel.status_code == 200)
