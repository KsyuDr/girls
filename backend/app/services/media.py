"""Фото меток на диске: проверка формата по содержимому, сохранение и удаление.

Файлы лежат в MEDIA_DIR (по умолчанию backend/media) и раздаются как статика /media/...
"""

import asyncio
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings
from app.core.errors import BadRequestError, PayloadTooLargeError

MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_PHOTOS_PER_INCIDENT = 4
MEDIA_URL_PREFIX = "/media"


def media_root() -> Path:
    return Path(get_settings().media_dir).resolve()


def media_url(file_path: str) -> str:
    return f"{MEDIA_URL_PREFIX}/{file_path}"


def sniff_image(data: bytes) -> tuple[str, str] | None:
    """Определяет формат по первым байтам (заголовку Content-Type от клиента не верим)."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


class ValidPhoto:
    def __init__(self, data: bytes, content_type: str, extension: str) -> None:
        self.data = data
        self.content_type = content_type
        self.extension = extension


async def read_photo(upload: UploadFile) -> ValidPhoto:
    data = await upload.read(MAX_PHOTO_BYTES + 1)
    name = upload.filename or "файл"
    if len(data) > MAX_PHOTO_BYTES:
        raise PayloadTooLargeError(f"{name}: фото больше 5 МБ")
    kind = sniff_image(data)
    if kind is None:
        raise BadRequestError(f"{name}: поддерживаются только фото JPG, PNG и WebP")
    return ValidPhoto(data, *kind)


async def save_photo(incident_id: int, photo: ValidPhoto) -> str:
    """Сохраняет файл и возвращает путь относительно MEDIA_DIR."""
    relative = f"incidents/{incident_id}/{uuid4().hex}.{photo.extension}"
    await asyncio.to_thread(_write, media_root() / relative, photo.data)
    return relative


async def delete_files(relative_paths: list[str]) -> None:
    root = media_root()
    await asyncio.to_thread(lambda: [(root / p).unlink(missing_ok=True) for p in relative_paths])


def _write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
