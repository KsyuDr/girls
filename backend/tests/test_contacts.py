import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EmergencyContact, User
from tests.conftest import Headers, LoginAs

MOM = {"name": "Ольга Мартынова", "relation": "Мама", "phone": "+7 912 204-18-33"}


async def add(client: AsyncClient, headers: Headers, **fields: object) -> dict:
    response = await client.post("/api/contacts", headers=headers, json={**MOM, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def phone(n: int) -> str:
    return f"+7922000000{n}"


# ---------- доступ ----------


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("GET", "/api/contacts"),
        ("POST", "/api/contacts"),
        ("PATCH", "/api/contacts/1"),
        ("DELETE", "/api/contacts/1"),
    ],
)
async def test_contacts_require_login(client: AsyncClient, method: str, url: str) -> None:
    response = await client.request(method, url, json=MOM)

    assert response.status_code == 401


# ---------- создание и список ----------


async def test_create_contact(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    body = await add(client, headers)

    assert body["name"] == "Ольга Мартынова"
    assert body["relation"] == "Мама"
    assert body["phone"] == "+79122041833"  # нормализован
    assert body["receivesSos"] is True
    assert body["notifyMethod"] == "sms_push"
    assert body["position"] == 0
    assert isinstance(body["id"], int)
    assert "createdAt" in body


async def test_create_contact_defaults_and_trim(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    body = await add(
        client,
        headers,
        name="  Ирина Козлова ",
        relation="   ",
        receivesSos=False,
        notifyMethod="sms",
    )
    without_relation = await client.post(
        "/api/contacts", headers=headers, json={"name": "Сергей", "phone": phone(1)}
    )

    assert body["name"] == "Ирина Козлова"
    assert body["relation"] == "Близкий"
    assert body["receivesSos"] is False
    assert body["notifyMethod"] == "sms"
    assert without_relation.json()["relation"] == "Близкий"


async def test_list_contacts_in_order(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    for n, name in enumerate(["Мама", "Сергей", "Дмитрий"]):
        await add(client, headers, name=name, phone=phone(n))

    response = await client.get("/api/contacts", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert [c["name"] for c in body] == ["Мама", "Сергей", "Дмитрий"]
    assert [c["position"] for c in body] == [0, 1, 2]


async def test_list_shows_only_own_contacts(client: AsyncClient, login_as: LoginAs) -> None:
    polina = await login_as(phone="+79120000001")
    ivan = await login_as(phone="+79120000002", name="Иван Петров")
    await add(client, polina)

    response = await client.get("/api/contacts", headers=ivan)

    assert response.json() == []


async def test_create_contact_validation(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    bad_phone = await client.post("/api/contacts", headers=headers, json={**MOM, "phone": "123"})
    short_name = await client.post("/api/contacts", headers=headers, json={**MOM, "name": " О "})
    long_relation = await client.post(
        "/api/contacts", headers=headers, json={**MOM, "relation": "м" * 51}
    )
    bad_method = await client.post(
        "/api/contacts", headers=headers, json={**MOM, "notifyMethod": "pigeon"}
    )
    no_phone = await client.post("/api/contacts", headers=headers, json={"name": "Ольга"})

    assert bad_phone.status_code == 422
    assert "российский номер" in bad_phone.text
    assert short_name.status_code == 422
    assert long_relation.status_code == 422
    assert bad_method.status_code == 422
    assert no_phone.status_code == 422


async def test_limit_five_contacts(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    for n in range(5):
        await add(client, headers, phone=phone(n))

    sixth = await client.post("/api/contacts", headers=headers, json={**MOM, "phone": phone(5)})

    assert sixth.status_code == 409
    assert "не больше 5" in sixth.json()["detail"]


async def test_limit_holds_under_parallel_requests(
    client: AsyncClient, login_as: LoginAs, db: AsyncSession
) -> None:
    headers = await login_as()
    for n in range(3):
        await add(client, headers, phone=phone(n))

    responses = await asyncio.gather(
        *(
            client.post("/api/contacts", headers=headers, json={**MOM, "phone": phone(n)})
            for n in range(3, 8)
        )
    )

    assert sorted(r.status_code for r in responses) == [201, 201, 409, 409, 409]
    assert await db.scalar(select(func.count()).select_from(EmergencyContact)) == 5


async def test_limit_frees_after_delete(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    created = [await add(client, headers, phone=phone(n)) for n in range(5)]

    await client.delete(f"/api/contacts/{created[1]['id']}", headers=headers)
    again = await client.post("/api/contacts", headers=headers, json={**MOM, "phone": phone(9)})

    assert again.status_code == 201
    assert again.json()["position"] == 5  # в конец списка


async def test_duplicate_phone_conflict(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    await add(client, headers)

    same = await client.post(
        "/api/contacts", headers=headers, json={**MOM, "phone": "8 (912) 204-18-33"}
    )

    assert same.status_code == 409
    assert "уже есть" in same.json()["detail"]


async def test_same_phone_for_different_users(client: AsyncClient, login_as: LoginAs) -> None:
    polina = await login_as(phone="+79120000001")
    ivan = await login_as(phone="+79120000002", name="Иван Петров")

    await add(client, polina)
    await add(client, ivan)


async def test_own_phone_is_rejected(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as(phone="+79120000001")

    response = await client.post(
        "/api/contacts", headers=headers, json={**MOM, "phone": "+7 912 000-00-01"}
    )

    assert response.status_code == 400
    assert "свой номер" in response.json()["detail"]


# ---------- изменение ----------


async def test_toggle_receives_sos(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    contact = await add(client, headers)

    off = await client.patch(
        f"/api/contacts/{contact['id']}", headers=headers, json={"receivesSos": False}
    )
    listed = await client.get("/api/contacts", headers=headers)

    assert off.status_code == 200
    assert off.json()["receivesSos"] is False
    assert off.json()["name"] == contact["name"]  # остальное не трогаем
    assert listed.json()[0]["receivesSos"] is False


async def test_update_contact_fields(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    contact = await add(client, headers)

    response = await client.patch(
        f"/api/contacts/{contact['id']}",
        headers=headers,
        json={
            "name": " Ольга Сергеевна ",
            "relation": "",
            "phone": "9220000009",
            "notifyMethod": "sms",
            "receivesSos": None,  # null игнорируется
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Ольга Сергеевна"
    assert body["relation"] == "Близкий"
    assert body["phone"] == "+79220000009"
    assert body["notifyMethod"] == "sms"
    assert body["receivesSos"] is True


async def test_update_keeps_own_phone(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    contact = await add(client, headers)

    response = await client.patch(
        f"/api/contacts/{contact['id']}", headers=headers, json={"phone": MOM["phone"]}
    )

    assert response.status_code == 200


async def test_update_to_taken_phone_conflict(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    await add(client, headers, phone=phone(1))
    second = await add(client, headers, phone=phone(2))

    response = await client.patch(
        f"/api/contacts/{second['id']}", headers=headers, json={"phone": phone(1)}
    )

    assert response.status_code == 409


async def test_update_to_own_phone_rejected(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as(phone="+79120000001")
    contact = await add(client, headers)

    response = await client.patch(
        f"/api/contacts/{contact['id']}", headers=headers, json={"phone": "+79120000001"}
    )

    assert response.status_code == 400


async def test_update_validation(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    contact = await add(client, headers)
    url = f"/api/contacts/{contact['id']}"

    bad_phone = await client.patch(url, headers=headers, json={"phone": "abc"})
    bad_flag = await client.patch(url, headers=headers, json={"receivesSos": "может быть"})

    assert bad_phone.status_code == 422
    assert bad_flag.status_code == 422


# ---------- удаление и чужие контакты ----------


async def test_delete_contact(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()
    contact = await add(client, headers)

    response = await client.delete(f"/api/contacts/{contact['id']}", headers=headers)
    again = await client.delete(f"/api/contacts/{contact['id']}", headers=headers)

    assert response.status_code == 204
    assert response.content == b""
    assert (await client.get("/api/contacts", headers=headers)).json() == []
    assert again.status_code == 404


async def test_foreign_contact_is_not_found(client: AsyncClient, login_as: LoginAs) -> None:
    polina = await login_as(phone="+79120000001")
    ivan = await login_as(phone="+79120000002", name="Иван Петров")
    contact = await add(client, polina)
    url = f"/api/contacts/{contact['id']}"

    patch = await client.patch(url, headers=ivan, json={"receivesSos": False})
    remove = await client.delete(url, headers=ivan)

    assert patch.status_code == 404
    assert remove.status_code == 404
    still = (await client.get("/api/contacts", headers=polina)).json()
    assert still[0]["receivesSos"] is True


async def test_missing_contact(client: AsyncClient, login_as: LoginAs) -> None:
    headers = await login_as()

    patch = await client.patch("/api/contacts/999", headers=headers, json={"name": "Кто-то"})
    remove = await client.delete("/api/contacts/999", headers=headers)
    not_int = await client.delete("/api/contacts/abc", headers=headers)

    assert patch.status_code == 404
    assert patch.json()["detail"] == "Контакт не найден"
    assert remove.status_code == 404
    assert not_int.status_code == 422


async def test_contacts_deleted_with_user(
    client: AsyncClient, login_as: LoginAs, db: AsyncSession
) -> None:
    headers = await login_as()
    await add(client, headers)

    await db.execute(delete(User))
    await db.commit()

    assert await db.scalar(select(func.count()).select_from(EmergencyContact)) == 0
