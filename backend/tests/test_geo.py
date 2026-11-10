import pytest

from app.core.geo import distance_meters


def test_same_point_is_zero() -> None:
    assert distance_meters(55.7520, 37.6175, 55.7520, 37.6175) == 0


def test_moscow_to_saint_petersburg() -> None:
    # Красная площадь -> Дворцовая площадь: по прямой около 634 км
    meters = distance_meters(55.7539, 37.6208, 59.9390, 30.3158)

    assert meters == pytest.approx(634_000, rel=0.01)


def test_short_distance_is_symmetric() -> None:
    # Одна угловая минута широты примерно равна морской миле, 1852 м
    there = distance_meters(55.0, 37.0, 55.0 + 1 / 60, 37.0)
    back = distance_meters(55.0 + 1 / 60, 37.0, 55.0, 37.0)

    assert there == back
    assert there == pytest.approx(1853, abs=5)


def test_antipodes_do_not_crash() -> None:
    assert distance_meters(0, 0, 0, 180) == pytest.approx(20_015_087, rel=0.001)
