"""Фото меток на диске: проверка формата, очистка метаданных, сохранение, подпись ссылок.

Файлы лежат в MEDIA_DIR (по умолчанию backend/media) и раздаются роутом /media/... —
не статикой: фото скрытой метки посторонним не отдаётся (app/api/routes/media.py).
"""

import asyncio
import hashlib
import hmac
import io
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.core.errors import BadRequestError, PayloadTooLargeError

MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_PHOTOS_PER_INCIDENT = 4
MAX_PHOTO_PIXELS = 40_000_000  # 40 Мп: больше не бывает у телефонов, а «бомбу» не распакуем
MEDIA_URL_PREFIX = "/media"

_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def media_root() -> Path:
    return Path(get_settings().media_dir).resolve()


def sign(file_path: str) -> str:
    key = get_settings().jwt_secret.encode()
    return hmac.new(key, f"media:{file_path}".encode(), hashlib.sha256).hexdigest()[:32]


def check_signature(file_path: str, signature: str | None) -> bool:
    return signature is not None and hmac.compare_digest(sign(file_path), signature)


def media_url(file_path: str, *, signed: bool = False) -> str:
    url = f"{MEDIA_URL_PREFIX}/{file_path}"
    return f"{url}?key={sign(file_path)}" if signed else url


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
    content_type, extension = kind
    try:
        clean = await asyncio.to_thread(strip_metadata, data, content_type)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise BadRequestError(f"{name}: файл повреждён или это не фото") from exc
    return ValidPhoto(clean, content_type, extension)


def strip_metadata(data: bytes, content_type: str) -> bytes:
    """Пересохраняет картинку без EXIF (GPS, модель телефона) и прочих метаданных.

    Поворот из EXIF применяем к пикселям, иначе фото с телефона «ляжет на бок».
    """
    image_format = _FORMATS[content_type]
    out = io.BytesIO()
    with Image.open(io.BytesIO(data)) as source:
        if source.format != image_format:
            raise ValueError("содержимое не совпадает с форматом")
        if source.width * source.height > MAX_PHOTO_PIXELS:
            raise ValueError("слишком большое разрешение")
        image = ImageOps.exif_transpose(source)
        if image_format == "JPEG" and image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        elif image_format == "PNG" and image.mode not in ("RGB", "RGBA", "L", "LA", "P"):
            image = image.convert("RGBA")
        # Метаданные не переносим: из info оставляем только прозрачность палитры
        image.info = {k: v for k, v in image.info.items() if k == "transparency"}
        if image_format == "JPEG":
            image.save(out, "JPEG", quality=90, optimize=True)
        elif image_format == "PNG":
            image.save(out, "PNG", optimize=True)
        else:
            image.save(out, "WEBP", quality=90)
    return out.getvalue()


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
