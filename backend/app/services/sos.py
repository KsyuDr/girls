"""SOS: отправка сигнала близким (в MVP доставка имитируется), отмена, завершение модератором."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError
from app.models import EmergencyContact, SosDelivery, SosSignal, User
from app.models.sos import (
    DELIVERY_DELIVERED,
    DELIVERY_FAILED,
    DELIVERY_SENDING,
    SOS_ACTIVE,
    SOS_CANCELLED,
    SOS_RESOLVED,
)
from app.schemas.sos import (
    DeliveryOut,
    IncomingSosOut,
    ModerationSosOut,
    SosCreateIn,
    SosLocationIn,
    SosOut,
)
from app.services import sms
from app.services.contacts import lock_user
from app.services.incidents import person_out

STATUS_LABELS = {SOS_ACTIVE: "активен", SOS_CANCELLED: "отменён", SOS_RESOLVED: "помощь пришла"}
ONE_ACTIVE_INDEX = "uq_sos_signals_one_active_per_user"
# Сколько близкий видит завершённый сигнал (отбой) в приложении
INCOMING_FINISHED_FOR = timedelta(hours=1)


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
    # Строка пользователя заблокирована до коммита: параллельные изменение и удаление контакта
    # ждут (они берут ту же блокировку), и доставка не сошлётся на удалённый контакт.
    await lock_user(session, user_id)
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
    except IntegrityError as exc:
        # Под блокировкой пользователя второй активный сигнал почти невозможен, но если
        # уникальный индекс всё же сработал — это параллельное нажатие, а не ошибка.
        await session.rollback()
        active = await get_active(session, user_id)
        if active is None or ONE_ACTIVE_INDEX not in str(exc.orig):
            raise
        await session.refresh(user)
        _remember_location(user, data)
        _update_location(active, data)
        await session.commit()
        return await get_sos(session, active.id), False

    await _deliver(session, sos.id, user_id)
    return await get_sos(session, sos.id), True


async def _deliver(session: AsyncSession, sos_id: int, user_id: int) -> None:
    """Рассылка SOS близким по одному.

    Перед каждой SMS строка сигнала блокируется и проверяется статус: отмена или «помощь
    пришла» ждут, пока текущая SMS уйдёт и запишется как доставленная, — поэтому отбой
    получат все, кому SOS ушёл, а после отмены новые SMS не уходят.
    Сверх лимита (см. _sms_allowed) SMS не отправляется: сигнал всё равно создан, его видят
    модераторы и близкие в приложении.
    """
    delivery_ids = (
        await session.scalars(
            select(SosDelivery.id).where(SosDelivery.sos_id == sos_id).order_by(SosDelivery.id)
        )
    ).all()
    allowed = await _sms_allowed(session, sos_id, user_id)
    for delivery_id in delivery_ids:
        row = (
            await session.execute(
                select(SosSignal.status, SosSignal.lat, SosSignal.lng)
                .where(SosSignal.id == sos_id)
                .with_for_update()
            )
        ).one()
        delivery = await session.get(SosDelivery, delivery_id, populate_existing=True)
        if delivery is None or delivery.status != DELIVERY_SENDING:
            await session.commit()
            continue
        if row.status != SOS_ACTIVE or delivery.contact_phone not in allowed:
            delivery.status = DELIVERY_FAILED  # не отправлено: сигнал завершён или лимит
        else:
            ok = await sms.send_sos(delivery.contact_phone, user_id, row.lat, row.lng)
            delivery.status = DELIVERY_DELIVERED if ok else DELIVERY_FAILED
        await session.commit()  # снимает блокировку сигнала


async def _sms_allowed(session: AsyncSession, sos_id: int, user_id: int) -> set[str]:
    """Номера, на которые можно отправить SMS по этому сигналу.

    Защита от SMS-бомбинга чужих номеров за счёт проекта: не больше N сигналов с SMS в час
    и не больше M разных номеров в сутки (менять контакты и слать на новые номера нельзя
    бесконечно). Номера, которым SMS уже уходили за сутки, лимит номеров не тратят.
    """
    settings = get_settings()
    now = func.clock_timestamp()
    signals = await session.scalar(
        select(func.count())
        .select_from(SosSignal)
        .where(
            SosSignal.user_id == user_id,
            SosSignal.id != sos_id,
            SosSignal.created_at >= now - timedelta(hours=1),
        )
    )
    if (signals or 0) >= settings.sos_with_sms_per_hour:
        return set()
    recent = set(
        (
            await session.scalars(
                select(SosDelivery.contact_phone)
                .join(SosSignal, SosSignal.id == SosDelivery.sos_id)
                .where(
                    SosSignal.user_id == user_id,
                    SosSignal.id != sos_id,
                    SosDelivery.status == DELIVERY_DELIVERED,
                    SosDelivery.created_at >= now - timedelta(days=1),
                )
                .distinct()
            )
        ).all()
    )
    phones = (
        await session.scalars(
            select(SosDelivery.contact_phone)
            .where(SosDelivery.sos_id == sos_id)
            .order_by(SosDelivery.id)
        )
    ).all()
    allowed = set()
    for phone in phones:
        if phone in recent:
            allowed.add(phone)
        elif len(recent) < settings.sos_sms_numbers_per_day:
            recent.add(phone)
            allowed.add(phone)
    return allowed


async def list_incoming(session: AsyncSession, user: User) -> list[IncomingSosOut]:
    """SOS, доставленные на номер пользователя (он — чей-то экстренный контакт): активные
    и завершённые за последний час — чтобы близкий увидел «отменён» или «помощь пришла»,
    а не просто пропавший баннер.

    Связь — по номеру из доставки, а не по контакту: контакт могли удалить после отправки,
    а сигнал уже ушёл. Свои сигналы не показываем. Активные и новые сверху.
    """
    rows = await session.execute(
        select(SosSignal, SosDelivery.contact_relation)
        .join(SosDelivery, SosDelivery.sos_id == SosSignal.id)
        .where(
            or_(
                SosSignal.status == SOS_ACTIVE,
                SosSignal.ended_at >= func.clock_timestamp() - INCOMING_FINISHED_FOR,
            ),
            SosSignal.user_id != user.id,
            SosDelivery.contact_phone == user.phone,
            SosDelivery.status == DELIVERY_DELIVERED,
        )
        .options(selectinload(SosSignal.user))
        .order_by(
            (SosSignal.status == SOS_ACTIVE).desc(),
            SosSignal.created_at.desc(),
            SosSignal.id.desc(),
        )
    )
    seen: set[int] = set()
    result = []
    for sos, relation in rows:
        if sos.id in seen:
            continue
        seen.add(sos.id)
        result.append(
            IncomingSosOut(
                id=sos.id,
                status=sos.status,
                lat=sos.lat,
                lng=sos.lng,
                address=sos.address,
                accuracy_meters=sos.accuracy_m,
                started_at=sos.created_at,
                ended_at=sos.ended_at,
                sender=person_out(sos.user, with_phone=True, full_name=True),
                relation=relation,
            )
        )
    return result


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
    срабатывает ровно одно, второе получает 409. Отбой («отменён» или «помощь пришла»)
    уходит, только если сигнал завершила именно эта операция, — всем, кому SOS доставлен.
    Если идёт рассылка, UPDATE ждёт блокировку строки (см. _deliver), поэтому список
    доставленных читаем после него.
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
    phones = (
        await session.scalars(
            select(SosDelivery.contact_phone)
            .where(SosDelivery.sos_id == sos.id, SosDelivery.status == DELIVERY_DELIVERED)
            .order_by(SosDelivery.id)
        )
    ).all()
    notify = sms.send_sos_cancelled if status == SOS_CANCELLED else sms.send_sos_resolved
    for phone in phones:
        await notify(phone, sos.user_id)


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
