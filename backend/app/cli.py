"""Служебные команды.

Назначить модератора (пользователь должен уже зарегистрироваться):
    uv run python -m app.cli set-role +79123456789 moderator
Снять роль:
    uv run python -m app.cli set-role +79123456789 user
"""

import argparse
import asyncio
import sys

from fastapi import HTTPException

from app.core.phone import normalize_phone
from app.db.session import SessionFactory, engine
from app.models.user import ROLES
from app.services.auth import set_role


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


def main() -> int:
    parser = argparse.ArgumentParser(prog="app.cli", description="Служебные команды бэкенда")
    commands = parser.add_subparsers(dest="command", required=True)

    set_role_cmd = commands.add_parser("set-role", help="Назначить роль пользователю")
    set_role_cmd.add_argument("phone", help="Номер телефона, например +79123456789")
    set_role_cmd.add_argument("role", choices=ROLES)

    args = parser.parse_args()
    if args.command == "set-role":
        try:
            phone = normalize_phone(args.phone)
        except ValueError as exc:
            parser.error(str(exc))
        return asyncio.run(_set_role(phone, args.role))
    return 1


if __name__ == "__main__":
    sys.exit(main())
