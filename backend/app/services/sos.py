"""SOS: отправка сигнала близким (в MVP доставка имитируется), отмена, завершение модератором."""

from datetime import UTC, datetime

from sqlalchemy import Select, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError
from app.models import EmergencyContact, SosDelivery, SosSignal, User
from app.models.sos import (
    DELIVERY_DELIVERED,
    DELIVERY_FAILED,
    SOS_ACTIVE,
    SOS_CANCELLED,
    SOS_RESOLVED,
)
from app.schemas.sos import DeliveryOut, ModerationSosOut, SosCreateIn, SosLocationIn, SosOut
from app.services import sms
from app.services.incidents import person_out

STATUS_LABELS = {SOS_ACTIVE: "активен", SOS_CANCELLED: "отменён", SOS_RESOLVED: "помощь пришла"}


def with_details(query: Select) -> Select:
    return query.options(
        selectinload(SosSignal.deliveries), selectinload(SosSignal.user)
    ).execution_options(populate_existing=True)


async def get_active(session: AsyncSession, user_id: int) -> SosSignal | None:
    return await session.scalar(
        with_details(
            select(SosSignal).where(SosSignal.user_id == user_id, SosSignal.status == SOS_ACTIVE)
        )
    )


async def get_sos(session: AsyncSession, sos_id: int) -> SosSignal:
    sos = await session.scalar(with_details(select(SosSignal).where(SosSignal.id == sos_id)))
    if sos is None:
        raise NotFoundError("Сигнал SOS не найден")
    return sos


async def send_sos(session: AsyncSession, user: User, data: SosCreateIn) -> tuple[SosSignal, bool]:
    """Создаёт сигнал и рассылает его контактам с флагом «получает SOS».

    Повторное нажатие при активном сигнале не создаёт второй, а обновляет местоположение.
    Возвращает (сигнал, создан_ли_новый).
    """
    user_id = (
        user.id
    )  # после rollback атрибуты user устаревают, а ленивая загрузка в async — ошибка
    _remember_location(user, data)

    active = await get_active(session, user_id)
    if active is not None:
        _update_location(active, data)
        await session.commit()
        return await get_sos(session, active.id), False

    sos = SosSignal(
        user_id=user_id,
        lat=data.lat if data.lat is not None else user.last_lat,
        lng=data.lng if data.lng is not None else user.last_lng,
        address=data.address or user.last_address,
        accuracy_m=data.accuracy_meters,
    )
    contacts = await session.scalars(
        select(EmergencyContact)
        .where(EmergencyContact.user_id == user_id, EmergencyContact.receives_sos.is_(True))
        .order_by(EmergencyContact.position, EmergencyContact.id)
    )
    sos.deliveries = [
        SosDelivery(
            contact_id=c.id,
            contact_name=c.name,
            contact_relation=c.relation,
            contact_phone=c.phone,
            channel=c.notify_method,
        )
        for c in contacts
    ]
    session.add(sos)
    try:
        await session.commit()
    except IntegrityError:  # параллельное нажатие уже создало активный сигнал
        await session.rollback()
        active = await get_active(session, user_id)
        if active is None:
            raise
        # Как при повторном нажатии: обновляем место уже созданного сигнала
        await session.refresh(user)
        _remember_location(user, data)
        _update_location(active, data)
        await session.commit()
        return await get_sos(session, active.id), False

    # Имитация доставки: мок-SMS пишет в лог и сразу «доставляет»
    for delivery in sos.deliveries:
        ok = await sms.send_sos(delivery.contact_phone, user_id, sos.lat, sos.lng)
        delivery.status = DELIVERY_DELIVERED if ok else DELIVERY_FAILED
    await session.commit()
    return await get_sos(session, sos.id), True


async def get_own_sos(session: AsyncSession, user: User, sos_id: int) -> SosSignal:
    """Свой сигнал по id (в том числе завершённый); чужой — 404."""
    sos = await get_sos(session, sos_id)
    if sos.user_id != user.id:
        raise NotFoundError("Сигнал SOS не найден")
    return sos


async def update_location(
    session: AsyncSession, user: User, sos_id: int, data: SosLocationIn
) -> SosSignal:
    """Досылка координат к конкретному сигналу. Никогда не создаёт новый:
    если сигнал уже завершён (отменён на другом устройстве, «помощь пришла»), — 409.

    Условный UPDATE: досылка не «воскресит» сигнал, завершённый параллельно.
    """
    user_id = user.id
    values: dict = {"lat": data.lat, "lng": data.lng}
    if data.address:
        values["address"] = data.address
    if data.accuracy_meters is not None:
        values["accuracy_m"] = data.accuracy_meters
    updated = await session.scalar(
        update(SosSignal)
        .where(SosSignal.id == sos_id, SosSignal.user_id == user_id, SosSignal.status == SOS_ACTIVE)
        .values(**values)
        .returning(SosSignal.id)
    )
    if updated is None:  # строка не изменилась — откатывать нечего
        sos = await get_own_sos(session, user, sos_id)  # 404, если сигнала нет или он чужой
        raise ConflictError(f"Сигнал SOS уже завершён ({STATUS_LABELS[sos.status]})")
    _remember_location(user, data)
    await session.commit()
    return await get_sos(session, sos_id)


async def cancel_sos(session: AsyncSession, user: User, sos_id: int | None) -> SosSignal:
    """Отмена своего сигнала. sos_id=None — отменить текущий активный."""
    if sos_id is None:
        sos = await get_active(session, user.id)
        if sos is None:
            raise NotFoundError("Активного сигнала SOS нет")
    else:
        sos = await get_sos(session, sos_id)
        if sos.user_id != user.id:
            raise NotFoundError("Сигнал SOS не найден")
    await finish(session, sos, SOS_CANCELLED)
    return await get_sos(session, sos.id)


async def finish(session: AsyncSession, sos: SosSignal, status: str) -> None:
    """Завершает активный сигнал (отмена пользователем или закрытие модератором).

    Условный UPDATE: из двух одновременных завершений (отмена и «помощь пришла»)
    срабатывает ровно одно, второе получает 409. SMS «отбой» уходит, только если
    сигнал отменила именно эта операция.
    """
    finished = await session.scalar(
        update(SosSignal)
        .where(SosSignal.id == sos.id, SosSignal.status == SOS_ACTIVE)
        .values(status=status, ended_at=datetime.now(UTC))
        .returning(SosSignal.id)
    )
    await session.commit()
    if finished is None:
        raise ConflictError("Сигнал SOS уже завершён")
    if status == SOS_CANCELLED:
        for delivery in sos.deliveries:
            if delivery.status == DELIVERY_DELIVERED:
                await sms.send_sos_cancelled(delivery.contact_phone, sos.user_id)


def _remember_location(user: User, data: SosCreateIn | SosLocationIn) -> None:
    """Последнее известное место пользователя — для карты и следующего SOS."""
    if data.lat is not None and data.lng is not None:
        user.last_lat, user.last_lng = data.lat, data.lng
        if data.address:
            user.last_address = data.address


def _update_location(sos: SosSignal, data: SosCreateIn) -> None:
    if data.lat is not None and data.lng is not None:
        sos.lat, sos.lng = data.lat, data.lng
    if data.address:
        sos.address = data.address
    if data.accuracy_meters is not None:
        sos.accuracy_m = data.accuracy_meters


def sos_out(sos: SosSignal) -> SosOut:
    return SosOut(**_fields(sos))


def moderation_sos_out(sos: SosSignal) -> ModerationSosOut:
    return ModerationSosOut(
        **_fields(sos), user=person_out(sos.user, with_phone=True, full_name=True)
    )


def _fields(sos: SosSignal) -> dict:
    return {
        "id": sos.id,
        "status": sos.status,
        "lat": sos.lat,
        "lng": sos.lng,
        "address": sos.address,
        "accuracy_meters": sos.accuracy_m,
        "started_at": sos.created_at,
        "ended_at": sos.ended_at,
        "notified_contacts": [
            DeliveryOut(
                id=d.id,
                contact_id=d.contact_id,
                name=d.contact_name,
                relation=d.contact_relation,
                phone=d.contact_phone,
                channel=d.channel,
                status=d.status,
            )
            for d in sos.deliveries
        ],
    }
