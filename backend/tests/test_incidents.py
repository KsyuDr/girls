from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Incident
from app.services.media import MAX_PHOTO_BYTES
from tests.conftest import Headers, LoginAs

# Красная площадь
HERE = {"lat": 55.7539, "lng": 37.6208}
FIRE = {
    "type": "fire",
    "description": "Задымление на втором этаже",
    "address": "ул. Никольская, 10",
    "lat": 55.7570,
    "lng": 37.6230,
}
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 64

POLINA = "+79120000001"
IVAN = "+79120000002"


async def create(client: AsyncClient, headers: Headers, **fields: object) -> dict:
    response = await client.post("/api/incidents", headers=headers, json={**FIRE, **fields})
    assert response.status_code == 201, response.text
    return response.json()


async def two_users(login_as: LoginAs) -> tuple[Headers, Headers]:
    polina = await login_as(phone=POLINA, name="Полина Исупова")
    ivan = await login_as(phone=IVAN, name="Иван Петров")
    return polina, ivan


async def set_status(db: AsyncSession, incident_id: int, status: str) -> None:
    await db.execute(update(Incident).where(Incident.id == incident_id).values(status=status))
    await db.commit()


# ---------- создание ----------


async def test_create_requires_login(client: AsyncClient) -> None:
    response = await client.post("/api/incidents", json=FIRE)

    assert response.status_code == 401


async def test_create_incident(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as(phone=POLINA)

    body = await create(client, headers, description="  Задымление на втором этаже ")

    assert isinstance(body["id"], int)
    assert body["type"] == "fire"
    assert body["description"] == "Задымление на втором этаже"
    assert body["status"] == "new"
    assert body["isMine"] is True
    assert body["author"] == {"id": 1, "name": "Полина И.", "phone": None}
    assert body["photos"] == []
    assert body["responsesCount"] == 0
    assert body["responses"] == []  # автору — список откликов
    assert body["myResponse"] is None
    assert body["closedAt"] is None
    assert body["createdAt"]


async def test_create_uses_last_location(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    no_location = await client.post(
        "/api/incidents", headers=headers, json={**FIRE, "lat": None, "lng": None}
    )
    await client.patch("/api/users/me", headers=headers, json={"lastLat": 55.1, "lastLng": 37.2})

    body = await create(client, headers, lat=None, lng=None)

    assert no_location.status_code == 400
    assert "геолокацию" in no_location.json()["detail"]
    assert (body["lat"], body["lng"]) == (55.1, 37.2)


async def test_create_validation(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    async def post(**fields: object) -> int:
        response = await client.post("/api/incidents", headers=headers, json={**FIRE, **fields})
        return response.status_code

    assert await post(type="meteor") == 422
    assert await post(description="  ") == 422
    assert await post(address="д") == 422
    assert await post(lat=91) == 422
    assert await post(lng=None) == 422  # одна координата без другой
    assert await post(type="help_needed") == 201
    assert await post(type="lost") == 201


async def test_anonymous_incident_hides_author(client: AsyncClient, login_as: LoginAs) -> None:
    polina, ivan = await two_users(login_as)
    incident = await create(client, polina, isAnonymous=True)

    for_author = await client.get(f"/api/incidents/{incident['id']}", headers=polina)
    for_other = await client.get(f"/api/incidents/{incident['id']}", headers=ivan)
    for_guest = await client.get(f"/api/incidents/{incident['id']}")

    assert for_author.json()["author"]["name"] == "Полина И."
    assert for_other.json()["author"] is None
    assert for_other.json()["isMine"] is False
    assert for_guest.json()["author"] is None
    assert for_guest.json()["isAnonymous"] is True


# ---------- список и фильтры ----------


async def test_list_is_public_newest_first(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    first = await create(client, headers)
    second = await create(client, headers, type="gas")

    response = await client.get("/api/incidents")

    assert response.status_code == 200
    body = response.json()
    assert [i["id"] for i in body] == [second["id"], first["id"]]
    assert body[0]["isMine"] is False  # гость
    assert body[0]["responses"] is None
    assert body[0]["distanceMeters"] is None


async def test_list_rejects_bad_token(client: AsyncClient) -> None:
    response = await client.get("/api/incidents", headers={"Authorization": "Bearer nope"})

    assert response.status_code == 401


async def test_list_filters(client: AsyncClient, login_as: LoginAs, db: AsyncSession) -> None:
    headers = await login_as()
    fire = await create(client, headers)
    gas = await create(client, headers, type="gas")
    lost = await create(client, headers, type="lost")
    await set_status(db, gas["id"], "in_progress")

    by_type = await client.get("/api/incidents", params=[("type", "fire"), ("type", "lost")])
    by_status = await client.get("/api/incidents", params={"status": "in_progress"})
    hidden_status = await client.get("/api/incidents", params={"status": "hidden"})
    bad_type = await client.get("/api/incidents", params={"type": "meteor"})

    assert {i["id"] for i in by_type.json()} == {fire["id"], lost["id"]}
    assert [i["id"] for i in by_status.json()] == [gas["id"]]
    assert hidden_status.status_code == 422
    assert bad_type.status_code == 422


async def test_list_distance_and_radius(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    near = await create(client, headers, lat=55.7545, lng=37.6208)  # ~70 м
    far = await create(client, headers, lat=55.8000, lng=37.6208)  # ~5 км

    with_distance = await client.get("/api/incidents", params=HERE)
    in_radius = await client.get("/api/incidents", params={**HERE, "radius": 1000})

    distances = {i["id"]: i["distanceMeters"] for i in with_distance.json()}
    assert 60 <= distances[near["id"]] <= 80
    assert 5000 <= distances[far["id"]] <= 5300
    assert [i["id"] for i in in_radius.json()] == [near["id"]]


async def test_list_parameter_errors(client: AsyncClient) -> None:
    only_lat = await client.get("/api/incidents", params={"lat": 55})
    radius_only = await client.get("/api/incidents", params={"radius": 500})
    huge_radius = await client.get("/api/incidents", params={**HERE, "radius": 100_000})
    mine_guest = await client.get("/api/incidents", params={"mine": True})

    assert only_lat.status_code == 400
    assert radius_only.status_code == 400
    assert huge_radius.status_code == 422
    assert mine_guest.status_code == 401


async def test_list_limit(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    for _ in range(3):
        await create(client, headers)

    response = await client.get("/api/incidents", params={"limit": 2})

    assert len(response.json()) == 2


async def test_hidden_incidents(client: AsyncClient, login_as: LoginAs, db: AsyncSession) -> None:
    polina, ivan = await two_users(login_as)
    hidden = await create(client, polina)
    visible = await create(client, polina, type="gas")
    await set_status(db, hidden["id"], "hidden")
    url = f"/api/incidents/{hidden['id']}"

    public = await client.get("/api/incidents")
    mine = await client.get("/api/incidents", headers=polina, params={"mine": True})
    others_mine = await client.get("/api/incidents", headers=ivan, params={"mine": True})

    assert [i["id"] for i in public.json()] == [visible["id"]]
    assert {i["id"] for i in mine.json()} == {hidden["id"], visible["id"]}
    assert others_mine.json() == []
    assert (await client.get(url)).status_code == 404
    assert (await client.get(url, headers=ivan)).status_code == 404
    assert (await client.get(url, headers=polina)).json()["status"] == "hidden"


async def test_get_missing_incident(client: AsyncClient) -> None:
    response = await client.get("/api/incidents/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Метка не найдена"


async def test_get_with_distance(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    incident = await create(client, headers)

    response = await client.get(f"/api/incidents/{incident['id']}", params=HERE)

    assert response.json()["distanceMeters"] > 0


# ---------- изменение автором ----------


async def test_author_updates_and_closes(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    incident = await create(client, headers)
    url = f"/api/incidents/{incident['id']}"

    edited = await client.patch(url, headers=headers, json={"description": "Пожар потушен"})
    closed = await client.patch(url, headers=headers, json={"status": "closed"})
    again = await client.patch(url, headers=headers, json={"description": "Ещё раз"})

    assert edited.status_code == 200
    assert edited.json()["description"] == "Пожар потушен"
    assert edited.json()["address"] == FIRE["address"]
    assert closed.json()["status"] == "closed"
    assert closed.json()["closedAt"] is not None
    assert again.status_code == 409


async def test_update_permissions(client: AsyncClient, login_as: LoginAs, db: AsyncSession) -> None:
    polina, ivan = await two_users(login_as)
    incident = await create(client, polina)
    url = f"/api/incidents/{incident['id']}"

    foreign = await client.patch(url, headers=ivan, json={"description": "Чужая правка"})
    to_progress = await client.patch(url, headers=polina, json={"status": "in_progress"})
    guest = await client.patch(url, json={"status": "closed"})
    await set_status(db, incident["id"], "hidden")
    hidden = await client.patch(url, headers=polina, json={"description": "Правка"})

    assert foreign.status_code == 403
    assert to_progress.status_code == 422  # автор может только закрыть
    assert guest.status_code == 401
    assert hidden.status_code == 409


# ---------- фото ----------


async def test_upload_photos(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    incident = await create(client, headers)
    url = f"/api/incidents/{incident['id']}/photos"

    response = await client.post(
        url,
        headers=headers,
        files=[
            ("files", ("a.png", PNG, "image/png")),
            ("files", ("b.jpg", JPG, "application/octet-stream")),  # тип по содержимому
            ("files", ("c.webp", WEBP, "image/webp")),
        ],
    )

    assert response.status_code == 201, response.text
    photos = response.json()
    assert [p["contentType"] for p in photos] == ["image/png", "image/jpeg", "image/webp"]
    assert photos[0]["sizeBytes"] == len(PNG)
    assert photos[0]["url"].startswith(f"/media/incidents/{incident['id']}/")
    file = await client.get(photos[0]["url"])
    assert file.status_code == 200
    assert file.content == PNG
    detail = (await client.get(f"/api/incidents/{incident['id']}")).json()
    assert [p["id"] for p in detail["photos"]] == [p["id"] for p in photos]


async def test_photo_limit(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    incident = await create(client, headers)
    url = f"/api/incidents/{incident['id']}/photos"
    three = [("files", (f"{n}.png", PNG, "image/png")) for n in range(3)]

    await client.post(url, headers=headers, files=three)
    too_many = await client.post(url, headers=headers, files=three[:2])
    last_one = await client.post(url, headers=headers, files=three[:1])

    assert too_many.status_code == 409
    assert "осталось мест: 1" in too_many.json()["detail"]
    assert last_one.status_code == 201


async def test_photo_validation(client: AsyncClient, login_as: LoginAs) -> None:
    polina, ivan = await two_users(login_as)
    incident = await create(client, polina)
    url = f"/api/incidents/{incident['id']}/photos"
    big = b"\x89PNG\r\n\x1a\n" + b"\x00" * MAX_PHOTO_BYTES

    not_image = await client.post(
        url, headers=polina, files={"files": ("x.png", b"<html>", "image/png")}
    )
    too_big = await client.post(url, headers=polina, files={"files": ("big.png", big, "image/png")})
    no_files = await client.post(url, headers=polina)
    foreign = await client.post(url, headers=ivan, files={"files": ("a.png", PNG, "image/png")})
    missing = await client.post(
        "/api/incidents/999/photos", headers=polina, files={"files": ("a.png", PNG, "image/png")}
    )

    assert not_image.status_code == 400
    assert "JPG, PNG и WebP" in not_image.json()["detail"]
    assert too_big.status_code == 413
    assert no_files.status_code == 422
    assert foreign.status_code == 403
    assert missing.status_code == 404
    detail = (await client.get(f"/api/incidents/{incident['id']}")).json()
    assert detail["photos"] == []


async def test_bad_photo_in_batch_saves_nothing(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    incident = await create(client, headers)

    response = await client.post(
        f"/api/incidents/{incident['id']}/photos",
        headers=headers,
        files=[
            ("files", ("a.png", PNG, "image/png")),
            ("files", ("b.gif", b"GIF89a", "image/gif")),
        ],
    )

    assert response.status_code == 400
    assert (await client.get(f"/api/incidents/{incident['id']}")).json()["photos"] == []


# ---------- отклики «Помогу» ----------


async def test_respond_and_author_sees_helper(client: AsyncClient, login_as: LoginAs) -> None:
    polina, ivan = await two_users(login_as)
    incident = await create(client, polina, type="help_needed", description="Нужна таблетка")
    url = f"/api/incidents/{incident['id']}"

    response = await client.post(f"{url}/responses", headers=ivan, json={"message": " Иду! "})

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "active"
    assert body["message"] == "Иду!"
    assert body["user"]["name"] == "Иван П."

    for_author = (await client.get(url, headers=polina)).json()
    assert for_author["responsesCount"] == 1
    assert for_author["responses"][0]["user"] == {"id": 2, "name": "Иван П.", "phone": IVAN}

    for_helper = (await client.get(url, headers=ivan)).json()
    assert for_helper["responses"] is None
    assert for_helper["myResponse"]["id"] == body["id"]

    for_guest = (await client.get(url)).json()
    assert for_guest["responsesCount"] == 1
    assert for_guest["myResponse"] is None


async def test_respond_without_body(client: AsyncClient, login_as: LoginAs) -> None:
    polina, ivan = await two_users(login_as)
    incident = await create(client, polina)

    response = await client.post(f"/api/incidents/{incident['id']}/responses", headers=ivan)

    assert response.status_code == 201
    assert response.json()["message"] is None


async def test_respond_errors(client: AsyncClient, login_as: LoginAs, db: AsyncSession) -> None:
    polina, ivan = await two_users(login_as)
    incident = await create(client, polina)
    url = f"/api/incidents/{incident['id']}/responses"

    own = await client.post(url, headers=polina)
    guest = await client.post(url)
    first = await client.post(url, headers=ivan)
    twice = await client.post(url, headers=ivan)
    missing = await client.post("/api/incidents/999/responses", headers=ivan)
    too_long = await client.post(url, headers=ivan, json={"message": "а" * 501})

    assert own.status_code == 400
    assert guest.status_code == 401
    assert first.status_code == 201
    assert twice.status_code == 409
    assert missing.status_code == 404
    assert too_long.status_code == 422

    await set_status(db, incident["id"], "hidden")
    hidden = await client.post(url, headers=ivan)
    assert hidden.status_code == 404


async def test_cancel_and_respond_again(client: AsyncClient, login_as: LoginAs) -> None:
    polina, ivan = await two_users(login_as)
    incident = await create(client, polina)
    url = f"/api/incidents/{incident['id']}"

    first = await client.post(f"{url}/responses", headers=ivan)
    cancelled = await client.delete(f"{url}/responses/me", headers=ivan)
    count_after_cancel = (await client.get(url)).json()["responsesCount"]
    cancel_again = await client.delete(f"{url}/responses/me", headers=ivan)
    again = await client.post(f"{url}/responses", headers=ivan, json={"message": "Всё-таки иду"})

    assert cancelled.status_code == 204
    assert count_after_cancel == 0
    assert cancel_again.status_code == 404
    assert again.status_code == 201
    assert again.json()["id"] == first.json()["id"]  # та же запись, снова активна
    assert again.json()["message"] == "Всё-таки иду"


async def test_closing_marks_responses_done(client: AsyncClient, login_as: LoginAs) -> None:
    polina, ivan = await two_users(login_as)
    incident = await create(client, polina, type="lost", description="Потерял телефон у метро")
    url = f"/api/incidents/{incident['id']}"
    await client.post(f"{url}/responses", headers=ivan, json={"message": "Нашёл"})

    closed = await client.patch(url, headers=polina, json={"status": "closed"})
    late = await client.post(f"{url}/responses", headers=await login_as(phone="+79120000003"))

    assert closed.json()["responses"][0]["status"] == "done"
    assert closed.json()["responsesCount"] == 0
    assert late.status_code == 409
