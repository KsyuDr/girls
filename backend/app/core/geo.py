"""Расстояние между точками на сфере (формула гаверсинуса). PostGIS для MVP не нужен."""

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6_371_000


def distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Расстояние по прямой в метрах, округлённое до целого."""
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = radians(lng2 - lng1)
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return round(2 * EARTH_RADIUS_M * asin(min(1.0, sqrt(a))))
