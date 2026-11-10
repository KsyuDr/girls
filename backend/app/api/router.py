"""Сборка всех роутеров под общим префиксом /api (его ждёт фронтенд)."""

from fastapi import APIRouter

from app.api.routes import (
    alerts,
    auth,
    contacts,
    dashboard,
    health,
    incidents,
    moderation,
    reference,
    sos,
    users,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(reference.router)
api_router.include_router(contacts.router)
api_router.include_router(incidents.router)
api_router.include_router(sos.router)
api_router.include_router(alerts.router)
api_router.include_router(moderation.router)
api_router.include_router(dashboard.router)
