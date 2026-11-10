from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.reference.alerts_seed import DEMO_ALERTS
from app.services.alerts import seed_alerts
from tests.conftest import Headers, LoginAs

STORM = {
    "title": "Штормовое предупреждение",
    "subtitle": "Ветер до 25 м/с",
    "description": "Сегодня с 18:00 до 06:00 ветер до 25 м/с.",
    "level": "critical",
    "sourceLabel": "Гидрометцентр",
    "actionsChecklist": ["Уберите вещи с балконов", "  ", "Оставайтесь дома"],
}


async def moderator(login_as: LoginAs) -> Headers:
    return await login_as(phone="+79120000099", name="Анна Модератор", role="moderator")


async def publish(client: AsyncClient, headers: Headers, **fields: object) -> dict:
    response = await client.post("/api/alerts", headers=headers, json={**STORM, **fields})
    assert response.status_code == 201, response.text
    return response.json()


async def test_create_alert(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await moderator(login_as)

    body = await publish(client, headers)

    assert body["title"] == "Штормовое предупреждение"
    assert body["level"] == "critical"
    assert body["locationLabel"] == "Весь город"  # по умолчанию
    assert body["sourceLabel"] == "Гидрометцентр"
    assert body["actionsChecklist"] == ["Уберите вещи с балконов", "Оставайтесь дома"]
    assert body["isPublished"] is True
    assert body["createdAt"]


async def test_create_alert_minimal(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await moderator(login_as)

    response = await client.post(
        "/api/alerts", headers=headers, json={"title": "Тест", "description": "Проверка"}
    )

    body = response.json()
    assert response.status_code == 201
    assert body["level"] == "warning"
    assert body["subtitle"] is None
    assert body["actionsChecklist"] == []


async def test_create_alert_permissions(client: AsyncClient, login_as: LoginAs) -> None:
    user = await login_as()

    guest = await client.post("/api/alerts", json=STORM)
    resident = await client.post("/api/alerts", headers=user, json=STORM)

    assert guest.status_code == 401
    assert resident.status_code == 403
    assert resident.json()["detail"] == "Доступно только модераторам"


async def test_create_alert_validation(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await moderator(login_as)

    async def post(**fields: object) -> int:
        response = await client.post("/api/alerts", headers=headers, json={**STORM, **fields})
        return response.status_code

    assert await post(level="apocalypse") == 422
    assert await post(title="  ") == 422
    assert await post(description="") == 422
    assert await post(actionsChecklist=["шаг"] * 11) == 422
    assert await post(locationLabel="р" * 101) == 422


async def test_feed_is_public_newest_first(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await moderator(login_as)
    old = await publish(client, headers, title="Первое")
    new = await publish(client, headers, title="Второе", level="info")

    response = await client.get("/api/alerts")

    assert response.status_code == 200
    assert [a["id"] for a in response.json()] == [new["id"], old["id"]]


async def test_feed_filters_and_limit(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await moderator(login_as)
    critical = await publish(client, headers, level="critical")
    warning = await publish(client, headers, level="warning")
    await publish(client, headers, level="info")

    one_level = await client.get("/api/alerts", params={"level": "critical"})
    two_levels = await client.get(
        "/api/alerts", params=[("level", "critical"), ("level", "warning")]
    )
    limited = await client.get("/api/alerts", params={"limit": 1})
    bad_level = await client.get("/api/alerts", params={"level": "doom"})

    assert [a["id"] for a in one_level.json()] == [critical["id"]]
    assert {a["id"] for a in two_levels.json()} == {critical["id"], warning["id"]}
    assert len(limited.json()) == 1
    assert bad_level.status_code == 422


async def test_unpublish_alert(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await moderator(login_as)
    user = await login_as()
    alert = await publish(client, headers)
    url = f"/api/alerts/{alert['id']}"

    hidden = await client.patch(url, headers=headers, json={"isPublished": False})

    assert hidden.status_code == 200
    assert hidden.json()["isPublished"] is False
    assert (await client.get("/api/alerts")).json() == []
    assert (await client.get(url)).status_code == 404
    assert (await client.get(url, headers=user)).status_code == 404
    assert (await client.get(url, headers=headers)).status_code == 200


async def test_update_alert(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await moderator(login_as)
    user = await login_as()
    alert = await publish(client, headers)
    url = f"/api/alerts/{alert['id']}"

    edited = await client.patch(
        url, headers=headers, json={"level": "warning", "title": None, "actionsChecklist": []}
    )
    resident = await client.patch(url, headers=user, json={"level": "info"})
    missing = await client.patch("/api/alerts/999", headers=headers, json={"level": "info"})

    assert edited.json()["level"] == "warning"
    assert edited.json()["title"] == STORM["title"]  # null игнорируется
    assert edited.json()["actionsChecklist"] == []
    assert resident.status_code == 403
    assert missing.status_code == 404


async def test_get_alert(client: AsyncClient, login_as: LoginAs) -> None:
    alert = await publish(client, await moderator(login_as))

    found = await client.get(f"/api/alerts/{alert['id']}")
    missing = await client.get("/api/alerts/999")

    assert found.json()["id"] == alert["id"]
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Оповещение не найдено"


async def test_seed_alerts(client: AsyncClient, db: AsyncSession) -> None:
    first = await seed_alerts(db, DEMO_ALERTS)
    second = await seed_alerts(db, DEMO_ALERTS)

    assert first == len(DEMO_ALERTS)
    assert second == 0
    feed = (await client.get("/api/alerts")).json()
    assert feed[0]["title"] == "Штормовое предупреждение"  # последний в наборе — самый свежий
    assert {a["level"] for a in feed} == {"critical", "warning", "info"}
