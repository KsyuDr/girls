from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Incident
from tests.conftest import Headers, LoginAs

FIRE = {
    "type": "fire",
    "description": "Задымление в подъезде",
    "address": "ул. Никольская, 10",
    "lat": 55.757,
    "lng": 37.623,
}
MODERATOR_PHONE = "+79120000099"


async def moderator(login_as: LoginAs) -> Headers:
    return await login_as(phone=MODERATOR_PHONE, name="Анна Смирнова", role="moderator")


async def report(client: AsyncClient, headers: Headers, **fields: object) -> dict:
    response = await client.post("/api/incidents", headers=headers, json={**FIRE, **fields})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("GET", "/api/moderation/incidents"),
        ("PATCH", "/api/moderation/incidents/1"),
        ("GET", "/api/moderation/sos"),
        ("POST", "/api/moderation/sos/1/resolve"),
        ("GET", "/api/moderation/stats"),
    ],
)
async def test_moderation_is_for_moderators_only(
    client: AsyncClient, login_as: LoginAs, method: str, url: str
) -> None:
    resident = await login_as()

    guest = await client.request(method, url, json={"status": "closed"})
    user = await client.request(method, url, headers=resident, json={"status": "closed"})

    assert guest.status_code == 401
    assert user.status_code == 403


async def test_moderator_sees_everything(client: AsyncClient, login_as: LoginAs) -> None:
    resident = await login_as(phone="+79120000001", name="Полина Исупова")
    mod = await moderator(login_as)
    anonymous = await report(client, resident, isAnonymous=True)
    spam = await report(client, resident, type="other", description="Реклама")
    await client.patch(
        f"/api/moderation/incidents/{spam['id']}", headers=mod, json={"status": "hidden"}
    )

    response = await client.get("/api/moderation/incidents", headers=mod)

    body = response.json()
    assert response.status_code == 200
    assert {i["id"] for i in body} == {anonymous["id"], spam["id"]}
    anon = next(i for i in body if i["id"] == anonymous["id"])
    assert anon["isAnonymous"] is True
    assert anon["author"] == {"id": 1, "name": "Полина Исупова", "phone": "+79120000001"}
    assert anon["moderatorNote"] is None
    assert anon["responses"] == []


async def test_moderation_filters(client: AsyncClient, login_as: LoginAs) -> None:
    resident = await login_as()
    mod = await moderator(login_as)
    fire = await report(client, resident)
    gas = await report(client, resident, type="gas")
    await client.patch(
        f"/api/moderation/incidents/{gas['id']}", headers=mod, json={"status": "hidden"}
    )

    hidden = await client.get("/api/moderation/incidents", headers=mod, params={"status": "hidden"})
    fires = await client.get("/api/moderation/incidents", headers=mod, params={"type": "fire"})

    assert [i["id"] for i in hidden.json()] == [gas["id"]]
    assert [i["id"] for i in fires.json()] == [fire["id"]]


async def test_status_flow(client: AsyncClient, login_as: LoginAs) -> None:
    resident = await login_as(phone="+79120000001")
    helper = await login_as(phone="+79120000002", name="Иван Петров")
    mod = await moderator(login_as)
    incident = await report(client, resident)
    await client.post(f"/api/incidents/{incident['id']}/responses", headers=helper)
    url = f"/api/moderation/incidents/{incident['id']}"

    in_work = await client.patch(
        url, headers=mod, json={"status": "in_progress", "moderatorNote": " Позвонили в 101 "}
    )
    closed = await client.patch(url, headers=mod, json={"status": "closed"})
    reopened = await client.patch(url, headers=mod, json={"status": "new", "moderatorNote": ""})

    assert in_work.status_code == 200
    assert in_work.json()["status"] == "in_progress"
    assert in_work.json()["moderatorNote"] == "Позвонили в 101"
    assert closed.json()["status"] == "closed"
    assert closed.json()["closedAt"] is not None
    assert closed.json()["moderatorNote"] == "Позвонили в 101"  # не передали — не меняется
    assert closed.json()["responses"][0]["status"] == "done"
    assert reopened.json()["status"] == "new"
    assert reopened.json()["closedAt"] is None
    assert reopened.json()["moderatorNote"] is None
    # Жителю статус виден, заметка модератора — нет
    public = (await client.get(f"/api/incidents/{incident['id']}")).json()
    assert public["status"] == "new"
    assert "moderatorNote" not in public


async def test_hidden_disappears_from_map(client: AsyncClient, login_as: LoginAs) -> None:
    resident = await login_as()
    mod = await moderator(login_as)
    incident = await report(client, resident)

    await client.patch(
        f"/api/moderation/incidents/{incident['id']}", headers=mod, json={"status": "hidden"}
    )

    assert (await client.get("/api/incidents")).json() == []
    assert (await client.get(f"/api/incidents/{incident['id']}")).status_code == 404
    # Модератору и автору метка по-прежнему доступна
    assert (await client.get(f"/api/incidents/{incident['id']}", headers=mod)).status_code == 200


async def test_update_validation(client: AsyncClient, login_as: LoginAs) -> None:
    resident = await login_as()
    mod = await moderator(login_as)
    incident = await report(client, resident)
    url = f"/api/moderation/incidents/{incident['id']}"

    no_status = await client.patch(url, headers=mod, json={"moderatorNote": "x"})
    bad_status = await client.patch(url, headers=mod, json={"status": "deleted"})
    long_note = await client.patch(
        url, headers=mod, json={"status": "new", "moderatorNote": "x" * 1001}
    )
    missing = await client.patch(
        "/api/moderation/incidents/999", headers=mod, json={"status": "closed"}
    )

    assert no_status.status_code == 422
    assert bad_status.status_code == 422
    assert long_note.status_code == 422
    assert missing.status_code == 404


async def test_active_sos_and_resolve(client: AsyncClient, login_as: LoginAs) -> None:
    resident = await login_as(phone="+79120000001", name="Полина Исупова")
    mod = await moderator(login_as)
    sos = (
        await client.post("/api/sos", headers=resident, json={"lat": 55.75, "lng": 37.62})
    ).json()

    active = await client.get("/api/moderation/sos", headers=mod)
    resolved = await client.post(f"/api/moderation/sos/{sos['id']}/resolve", headers=mod)
    again = await client.post(f"/api/moderation/sos/{sos['id']}/resolve", headers=mod)
    after = await client.get("/api/moderation/sos", headers=mod)
    history = await client.get(
        "/api/moderation/sos", headers=mod, params=[("status", "resolved"), ("status", "cancelled")]
    )
    missing = await client.post("/api/moderation/sos/999/resolve", headers=mod)

    assert [s["id"] for s in active.json()] == [sos["id"]]
    assert active.json()[0]["user"] == {
        "id": 1,
        "name": "Полина Исупова",
        "phone": "+79120000001",
    }
    assert resolved.json()["status"] == "resolved"
    assert resolved.json()["endedAt"] is not None
    assert again.status_code == 409
    assert after.json() == []
    assert [s["id"] for s in history.json()] == [sos["id"]]
    assert missing.status_code == 404
    assert (await client.get("/api/sos/active", headers=resident)).json() is None


async def test_stats(client: AsyncClient, login_as: LoginAs, db: AsyncSession) -> None:
    resident = await login_as()
    mod = await moderator(login_as)
    empty = (await client.get("/api/moderation/stats", headers=mod)).json()
    first = await report(client, resident)
    second = await report(client, resident)
    await report(client, resident)
    spam = await report(client, resident)
    await client.post("/api/sos", headers=resident)

    # Метки «созданы» 10 и 4 минуты назад — так проверим среднее время реакции
    now = datetime.now(UTC)
    for incident, minutes in ((first, 10), (second, 4)):
        await db.execute(
            update(Incident)
            .where(Incident.id == incident["id"])
            .values(created_at=now - timedelta(minutes=minutes))
        )
    await db.commit()
    for incident in (first, second):
        await client.patch(
            f"/api/moderation/incidents/{incident['id']}",
            headers=mod,
            json={"status": "in_progress"},
        )
    await client.patch(
        f"/api/moderation/incidents/{spam['id']}", headers=mod, json={"status": "hidden"}
    )

    stats = (await client.get("/api/moderation/stats", headers=mod)).json()

    assert empty == {
        "newIncidents": 0,
        "inProgress": 0,
        "hidden": 0,
        "activeSos": 0,
        "avgReactionMinutes": None,
        "avgReactionMinutesPrev": None,
    }
    assert stats["newIncidents"] == 1
    assert stats["inProgress"] == 2
    assert stats["hidden"] == 1
    assert stats["activeSos"] == 1
    # (10 + 4 + ~0 у скрытой) / 3 ≈ 4.7 минуты
    assert stats["avgReactionMinutes"] == pytest.approx(4.7, abs=0.2)
    assert stats["avgReactionMinutesPrev"] is None


async def test_reaction_time_counts_once(client: AsyncClient, login_as: LoginAs) -> None:
    resident = await login_as()
    mod = await moderator(login_as)
    incident = await report(client, resident)
    url = f"/api/moderation/incidents/{incident['id']}"

    first = await client.patch(url, headers=mod, json={"status": "in_progress"})
    await client.patch(url, headers=mod, json={"status": "closed"})
    later = await client.patch(url, headers=mod, json={"status": "in_progress"})

    # reacted_at наружу не отдаём, но updatedAt меняется, а среднее не должно «уплывать»
    assert first.status_code == later.status_code == 200
    stats = (await client.get("/api/moderation/stats", headers=mod)).json()
    assert stats["avgReactionMinutes"] == pytest.approx(0, abs=0.1)
