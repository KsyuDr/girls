"""Все модели импортируются здесь, чтобы Alembic видел их через Base.metadata."""

from app.db.base import Base
from app.models.auth_code import AuthCode
from app.models.emergency_contact import EmergencyContact
from app.models.incident import Incident, IncidentPhoto, IncidentResponse
from app.models.place import Place
from app.models.user import User

__all__ = [
    "AuthCode",
    "Base",
    "EmergencyContact",
    "Incident",
    "IncidentPhoto",
    "IncidentResponse",
    "Place",
    "User",
]
