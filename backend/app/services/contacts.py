"""Экстренные контакты: до MAX_CONTACTS близких, каждому можно включить получение SOS."""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, ConflictError, NotFoundError
from app.models import EmergencyContact, User
from app.reference import MAX_CONTACTS
from app.schemas.contact import DEFAULT_RELATION, ContactCreateIn, ContactUpdateIn


async def list_contacts(session: AsyncSession, user_id: int) -> Sequence[EmergencyContact]:
    return (
        await session.scalars(
            select(EmergencyContact)
            .where(EmergencyContact.user_id == user_id)
            .order_by(EmergencyContact.position, EmergencyContact.id)
        )
    ).all()


async def create_contact(
    session: AsyncSession, user: User, data: ContactCreateIn
) -> EmergencyContact:
    await lock_user(session, user.id)
    contacts = await list_contacts(session, user.id)
    if len(contacts) >= MAX_CONTACTS:
        raise ConflictError(f"Можно добавить не больше {MAX_CONTACTS} контактов")
    _check_phone(user, contacts, data.phone)

    contact = EmergencyContact(
        user_id=user.id,
        name=data.name,
        relation=data.relation or DEFAULT_RELATION,
        phone=data.phone,
        receives_sos=data.receives_sos,
        notify_method=data.notify_method,
        position=max((c.position for c in contacts), default=-1) + 1,
    )
    session.add(contact)
    await session.flush()
    await session.refresh(contact)  # до коммита: см. update_contact
    await session.commit()
    return contact


async def update_contact(
    session: AsyncSession, user: User, contact_id: int, data: ContactUpdateIn
) -> EmergencyContact:
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    await lock_user(session, user.id)
    contact = await _get_own(session, user.id, contact_id)

    if "phone" in changes and changes["phone"] != contact.phone:
        others = [c for c in await list_contacts(session, user.id) if c.id != contact.id]
        _check_phone(user, others, changes["phone"])
    if "relation" in changes:
        changes["relation"] = changes["relation"] or DEFAULT_RELATION

    for field, value in changes.items():
        setattr(contact, field, value)
    # Перечитываем до коммита, пока строка пользователя заблокирована: после коммита
    # параллельный DELETE мог бы удалить контакт, и refresh упал бы (было 500)
    await session.flush()
    await session.refresh(contact)
    await session.commit()
    return contact


async def delete_contact(session: AsyncSession, user: User, contact_id: int) -> None:
    await lock_user(session, user.id)
    contact = await _get_own(session, user.id, contact_id)
    await session.delete(contact)
    await session.commit()


async def _get_own(session: AsyncSession, user_id: int, contact_id: int) -> EmergencyContact:
    """Чужой контакт для пользователя не существует — отвечаем 404, а не 403.

    Вызывать под lock_user: изменение, удаление контакта и отправка SOS идут по очереди,
    поэтому контакт не исчезнет между чтением и записью.
    """
    contact = await session.get(EmergencyContact, contact_id, populate_existing=True)
    if contact is None or contact.user_id != user_id:
        raise NotFoundError("Контакт не найден")
    return contact


async def lock_user(session: AsyncSession, user_id: int) -> None:
    """Блокируем строку пользователя до коммита: два параллельных запроса не обойдут лимит,
    а SOS не возьмёт контакт, который в этот момент удаляют (см. services/sos.py)."""
    await session.execute(select(User.id).where(User.id == user_id).with_for_update())


def _check_phone(user: User, others: Sequence[EmergencyContact], phone: str) -> None:
    if phone == user.phone:
        raise BadRequestError("Нельзя добавить в контакты свой номер")
    if any(c.phone == phone for c in others):
        raise ConflictError("Этот номер уже есть в контактах")
