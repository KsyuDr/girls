"""Служебные команды.

Назначить модератора (пользователь должен уже зарегистрироваться):
    uv run python -m app.cli set-role +79123456789 moderator
Снять роль:
    uv run python -m app.cli set-role +79123456789 user
Загрузить демо-данные (повторный запуск ничего не дублирует):
    uv run python -m app.cli seed            # всё сразу
    uv run python -m app.cli seed-places     # справочные точки карты Москвы
    uv run python -m app.cli seed-alerts     # демо-оповещения для ленты
"""

import argparse
import asyncio
import sys

from fastapi import HTTPException

from app.core.phone import normalize_phone
from app.db.session import SessionFactory, engine
from app.models.user import ROLES
from app.reference.alerts_seed import DEMO_ALERTS
from app.reference.places_seed import MOSCOW_PLACES
from app.services.alerts import seed_alerts
from app.services.auth import set_role
from app.services.places import seed_places


async def _set_role(phone: str, role: str) -> int:
    try:
        async with SessionFactory() as session:
            user = await set_role(session, phone, role)
    except HTTPException as exc:
        print(exc.detail, file=sys.stderr)
        return 1
    finally:
        await engine.dispose()
    print(f"Готово: {user.name} ({user.phone}) теперь {user.role}")
    return 0


async def _seed(places: bool, alerts: bool) -> int:
    try:
        async with SessionFactory() as session:
            if places:
                added = await seed_places(session, MOSCOW_PLACES)
                print(f"Точки карты: добавлено {added}, всего в наборе {len(MOSCOW_PLACES)}")
            if alerts:
                added = await seed_alerts(session, DEMO_ALERTS)
                print(f"Оповещения: добавлено {added}, всего в наборе {len(DEMO_ALERTS)}")
    finally:
        await engine.dispose()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="app.cli", description="Служебные команды бэкенда")
    commands = parser.add_subparsers(dest="command", required=True)

    set_role_cmd = commands.add_parser("set-role", help="Назначить роль пользователю")
    set_role_cmd.add_argument("phone", help="Номер телефона, например +79123456789")
    set_role_cmd.add_argument("role", choices=ROLES)

    commands.add_parser("seed", help="Загрузить все демо-данные")
    commands.add_parser("seed-places", help="Загрузить справочные точки карты Москвы")
    commands.add_parser("seed-alerts", help="Загрузить демо-оповещения")

    args = parser.parse_args()
    if args.command == "set-role":
        try:
            phone = normalize_phone(args.phone)
        except ValueError as exc:
            parser.error(str(exc))
        return asyncio.run(_set_role(phone, args.role))
    if args.command in ("seed", "seed-places", "seed-alerts"):
        places = args.command in ("seed", "seed-places")
        alerts = args.command in ("seed", "seed-alerts")
        return asyncio.run(_seed(places, alerts))
    return 1


if __name__ == "__main__":
    sys.exit(main())
