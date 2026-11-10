import pytest

from app.core.phone import normalize_phone


@pytest.mark.parametrize(
    "raw",
    ["+7 912 345-67-89", "8 (912) 345-67-89", "89123456789", "79123456789", "9123456789"],
)
def test_normalize_valid(raw: str) -> None:
    assert normalize_phone(raw) == "+79123456789"


@pytest.mark.parametrize("raw", ["", "12345", "+1 202 555 0143", "+7 912 345-67-89-00", "abc"])
def test_normalize_invalid(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_phone(raw)
