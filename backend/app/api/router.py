"""Сборка всех роутеров под общим префиксом /api (его ждёт фронтенд)."""

from fastapi import APIRouter

from app.api.routes import auth, health, reference, users

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(reference.router)
