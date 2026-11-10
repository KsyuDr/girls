"""Небольшие справочники: типы меток, категории карты, города, подсказки."""

from app.schemas.reference import IncidentType, MapCategory, ReportNextStep

INCIDENT_TYPES: list[IncidentType] = [
    IncidentType(id="fire", label="Пожар", icon="flame", group="danger", hint="Пожарная охрана"),
    IncidentType(id="accident", label="ДТП", icon="car", group="danger", hint="ГИБДД"),
    IncidentType(id="threat", label="Угроза", icon="users", group="danger", hint="Полиция"),
    IncidentType(
        id="flood", label="Подтопление", icon="cloud-rain", group="danger", hint="Аварийная служба"
    ),
    IncidentType(id="gas", label="Запах газа", icon="zap", group="danger", hint="Газовая служба"),
    IncidentType(
        id="other", label="Другое", icon="more-horizontal", group="danger", hint="Служба 112"
    ),
    # «Люди помогают людям» — интерфейс во фронте появится позже (решение 7)
    IncidentType(
        id="help_needed",
        label="Нужна помощь",
        icon="hand-helping",
        group="help",
        hint="Если есть угроза жизни — сначала 112",
    ),
    IncidentType(
        id="lost", label="Потеряно", icon="search", group="lost_found", hint="Опишите приметы вещи"
    ),
    IncidentType(
        id="found",
        label="Найдено",
        icon="package-check",
        group="lost_found",
        hint="Не указывайте все приметы — пусть владелец их назовёт",
    ),
]
INCIDENT_TYPE_IDS: frozenset[str] = frozenset(t.id for t in INCIDENT_TYPES)

MAP_CATEGORIES: list[MapCategory] = [
    MapCategory(id="danger", label="Опасные места", dot_color="#ED0536"),
    MapCategory(id="shelter", label="Пункты помощи", dot_color="#00C9B7"),
    MapCategory(id="hospital", label="Больницы", dot_color="#008F82"),
    MapCategory(id="police", label="Полиция", dot_color="#007DA5"),
]

CITIES: list[str] = [
    "Москва",
    "Екатеринбург",
    "Санкт-Петербург",
    "Казань",
    "Новосибирск",
    "Нижний Новгород",
]

SOS_WAITING_TIPS: list[str] = [
    "Оставайтесь на месте, если это безопасно",
    "Не выключайте телефон и геолокацию",
    "Если можете говорить — позвоните 112",
]

# Что будет после отправки метки. В макете было «диспетчер передаст службе» —
# переписано под идею продукта: службы к системе не подключены (agents/01-product.md).
REPORT_NEXT_STEPS: list[ReportNextStep] = [
    ReportNextStep(
        id="step_1",
        title="Метка появится на карте",
        subtitle="Её сразу увидят жители поблизости",
    ),
    ReportNextStep(
        id="step_2",
        title="Модератор проверит сообщение",
        subtitle="Спам и ложные метки скрываются",
    ),
    ReportNextStep(
        id="step_3",
        title="Вы получите уведомление о статусе",
        subtitle="«Принято», «В работе», «Закрыто»",
    ),
]

MAX_CONTACTS = 5
