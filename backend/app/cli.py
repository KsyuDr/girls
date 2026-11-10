"""Служебные команды.

Назначить модератора (пользователь должен уже зарегистрироваться):
    uv run python -m app.cli set-role +79123456789 moderator
Снять роль:
    uv run python -m app.cli set-role +79123456789 user
Загрузить справочные точки карты Москвы (повторный запуск ничего не дублирует):
    uv run python -m app.cli seed-places
"""

import argparse
import asyncio
import sys

from fastapi import HTTPException

from app.core.phone import normalize_phone
from app.db.session import SessionFactory, engine
from app.models.user import ROLES
from app.reference.places_seed import MOSCOW_PLACES
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


async def _seed_places() -> int:
    try:
        async with SessionFactory() as session:
            added = await seed_places(session, MOSCOW_PLACES)
    finally:
        await engine.dispose()
    print(f"Готово: добавлено точек — {added}, всего в наборе — {len(MOSCOW_PLACES)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="app.cli", description="Служебные команды бэкенда")
    commands = parser.add_subparsers(dest="command", required=True)

    set_role_cmd = commands.add_parser("set-role", help="Назначить роль пользователю")
    set_role_cmd.add_argument("phone", help="Номер телефона, например +79123456789")
    set_role_cmd.add_argument("role", choices=ROLES)

    commands.add_parser("seed-places", help="Загрузить справочные точки карты Москвы")

    args = parser.parse_args()
    if args.command == "set-role":
        try:
            phone = normalize_phone(args.phone)
        except ValueError as exc:
            parser.error(str(exc))
        return asyncio.run(_set_role(phone, args.role))
    if args.command == "seed-places":
        return asyncio.run(_seed_places())
    return 1


if __name__ == "__main__":
    sys.exit(main())
