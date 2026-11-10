import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_prod_requires_custom_jwt_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="prod", _env_file=None)


def test_prod_accepts_long_secret() -> None:
    settings = Settings(environment="prod", jwt_secret="x" * 40, _env_file=None)

    assert settings.environment == "prod"


def test_debug_is_off_by_default() -> None:
    assert Settings(_env_file=None).debug is False
