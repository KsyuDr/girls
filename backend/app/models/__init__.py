"""Все модели импортируются здесь, чтобы Alembic видел их через Base.metadata."""

from app.db.base import Base

__all__ = ["Base"]
