"""Сид-данные справочных точек карты для Москвы.

Это демонстрационный набор для разработки карты: координаты приблизительные,
«опасные места» выдуманы. Телефоны — номера экстренных служб, а не конкретных учреждений.
Загрузка: `uv run python -m app.cli seed-places` (повторный запуск ничего не дублирует).
"""

from typing import TypedDict

from app.schemas.reference import PlaceCategory


class PlaceSeed(TypedDict):
    title: str
    category: PlaceCategory
    address: str
    lat: float
    lng: float
    hours_label: str
    phone: str
    is_open: bool


ROUND_THE_CLOCK = "Круглосуточно"

MOSCOW_PLACES: list[PlaceSeed] = [
    # Пункты помощи
    {
        "title": "Пункт обогрева",
        "category": "shelter",
        "address": "Курский вокзал, ул. Земляной Вал, 29",
        "lat": 55.7579,
        "lng": 37.6610,
        "hours_label": ROUND_THE_CLOCK,
        "phone": "112",
        "is_open": True,
    },
    {
        "title": "Пункт помощи",
        "category": "shelter",
        "address": "Парк Горького, ул. Крымский Вал, 9",
        "lat": 55.7298,
        "lng": 37.6011,
        "hours_label": "Ежедневно 10:00–22:00",
        "phone": "112",
        "is_open": True,
    },
    {
        "title": "Пункт обогрева",
        "category": "shelter",
        "address": "Парк «Сокольники», ул. Сокольнический Вал, 1",
        "lat": 55.7920,
        "lng": 37.6770,
        "hours_label": "Откроется при морозе ниже −15 °C",
        "phone": "112",
        "is_open": False,
    },
    # Больницы
    {
        "title": "НИИ скорой помощи им. Н. В. Склифосовского",
        "category": "hospital",
        "address": "Большая Сухаревская пл., 3",
        "lat": 55.7745,
        "lng": 37.6335,
        "hours_label": ROUND_THE_CLOCK,
        "phone": "103",
        "is_open": True,
    },
    {
        "title": "ГКБ № 1 им. Н. И. Пирогова",
        "category": "hospital",
        "address": "Ленинский пр-т, 8",
        "lat": 55.7253,
        "lng": 37.6040,
        "hours_label": ROUND_THE_CLOCK,
        "phone": "103",
        "is_open": True,
    },
    {
        "title": "ГКБ им. С. П. Боткина",
        "category": "hospital",
        "address": "2-й Боткинский пр-д, 5",
        "lat": 55.7836,
        "lng": 37.5559,
        "hours_label": ROUND_THE_CLOCK,
        "phone": "103",
        "is_open": True,
    },
    {
        "title": "Детская ГКБ им. Н. Ф. Филатова",
        "category": "hospital",
        "address": "ул. Садовая-Кудринская, 15",
        "lat": 55.7620,
        "lng": 37.5835,
        "hours_label": ROUND_THE_CLOCK,
        "phone": "103",
        "is_open": True,
    },
    # Полиция
    {
        "title": "ГУ МВД России по г. Москве",
        "category": "police",
        "address": "ул. Петровка, 38",
        "lat": 55.7680,
        "lng": 37.6140,
        "hours_label": ROUND_THE_CLOCK,
        "phone": "102",
        "is_open": True,
    },
    {
        "title": "Линейный отдел полиции",
        "category": "police",
        "address": "Ленинградский вокзал, Комсомольская пл., 3",
        "lat": 55.7765,
        "lng": 37.6555,
        "hours_label": ROUND_THE_CLOCK,
        "phone": "102",
        "is_open": True,
    },
    # Опасные места (демо)
    {
        "title": "Обрушение кровли",
        "category": "danger",
        "address": "ул. Мясницкая, 24",
        "lat": 55.7650,
        "lng": 37.6370,
        "hours_label": "Оцеплено",
        "phone": "112",
        "is_open": True,
    },
    {
        "title": "Открытый люк",
        "category": "danger",
        "address": "ул. Большая Дмитровка, 7",
        "lat": 55.7600,
        "lng": 37.6150,
        "hours_label": "Огорожено лентой",
        "phone": "112",
        "is_open": True,
    },
    {
        "title": "Гололёд на лестнице",
        "category": "danger",
        "address": "Чистопрудный бульвар, 12",
        "lat": 55.7610,
        "lng": 37.6460,
        "hours_label": "Не посыпано",
        "phone": "112",
        "is_open": True,
    },
]
