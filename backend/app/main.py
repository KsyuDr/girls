"""Точка входа FastAPI. Запуск: `uv run uvicorn app.main:app --reload`."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.routes import media
from app.core.config import get_settings
from app.core.middleware import BodySizeLimitMiddleware, SecurityHeadersMiddleware
from app.core.validation import validation_error_handler

# В dev фронт может подняться на любом порту localhost (Vite берёт :5174, если :5173 занят)
DEV_ORIGIN_REGEX = r"http://(localhost|127\.0\.0\.1)(:\d+)?"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
        docs_url="/docs",
        openapi_url="/api/openapi.json",
    )
    app.add_exception_handler(RequestValidationError, validation_error_handler)

    # Порядок: последний добавленный — внешний. CORS снаружи, чтобы и 413 ушёл с его заголовками
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_bytes)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=DEV_ORIGIN_REGEX if settings.is_dev else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    # Фото меток: backend/media/incidents/<id>/<файл> → /media/incidents/<id>/<файл>
    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
    app.include_router(media.router)
    return app


app = create_app()
