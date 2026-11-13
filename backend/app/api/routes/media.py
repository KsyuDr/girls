"""Раздача фото меток. Вместо статики — роут: фото скрытой метки посторонним не отдаём."""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.core.errors import NotFoundError
from app.db.session import SessionDep
from app.models import Incident, IncidentPhoto
from app.models.incident import STATUS_HIDDEN
from app.services import media

router = APIRouter(prefix=media.MEDIA_URL_PREFIX, tags=["media"])


@router.get(
    "/{file_path:path}",
    summary="Фото метки (у скрытой — только по подписанной ссылке автора или модератора)",
    response_class=FileResponse,
)
async def get_media(
    file_path: str,
    session: SessionDep,
    key: Annotated[str | None, Query(description="Подпись из photos[].url")] = None,
) -> FileResponse:
    if "\x00" in file_path:  # PostgreSQL не примет NUL в параметре запроса
        raise NotFoundError("Файл не найден")
    # Путь ищем в базе как есть: произвольный файл с диска (../) так не получить
    row = (
        await session.execute(
            select(IncidentPhoto.content_type, Incident.status)
            .join(Incident, Incident.id == IncidentPhoto.incident_id)
            .where(IncidentPhoto.file_path == file_path)
        )
    ).first()
    if row is None:
        raise NotFoundError("Файл не найден")
    content_type, status = row
    if status == STATUS_HIDDEN and not media.check_signature(file_path, key):
        raise NotFoundError("Файл не найден")

    path = media.media_root() / Path(file_path)
    if not path.is_file():
        raise NotFoundError("Файл не найден")
    # Кэш короткий и только в браузере: после скрытия метки фото быстро перестанет открываться
    return FileResponse(
        path, media_type=content_type, headers={"Cache-Control": "private, max-age=300"}
    )
