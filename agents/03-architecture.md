# Архитектура

```
frontend (React + Vite, :5173) ──HTTP/JSON──▶ backend (FastAPI, :8000, префикс /api) ──▶ PostgreSQL (:5433)
                                                       └── backend/media/ (фото меток)
```

## Репозиторий
```
.
├── agents/               # решения и контекст (читать первым)
├── backend/              # FastAPI
├── frontend/             # React + Vite
├── docker-compose.yml    # PostgreSQL для разработки и тестов
├── .pre-commit-config.yaml
└── .github/workflows/ci.yml
```

## Бэкенд (`backend/`)
```
app/
├── main.py              # create_app(): CORS, роутеры, статика /media
├── core/
│   ├── config.py        # Settings (pydantic-settings, .env)
│   └── security.py      # JWT, текущий пользователь, проверка роли        (этап 1)
├── db/
│   ├── base.py          # Base, naming convention, TimestampMixin
│   └── session.py       # engine, SessionFactory, SessionDep
├── models/              # SQLAlchemy-модели; все импортируются в models/__init__.py
├── schemas/             # Pydantic-схемы; наследуются от CamelModel
├── services/            # бизнес-логика (роуты тонкие, логика здесь)
├── reference/           # статичные справочники: службы, памятки, типы   (этап 2)
└── api/
    ├── router.py        # общий APIRouter(prefix="/api")
    ├── deps.py          # зависимости: CurrentUser, ModeratorUser       (этап 1)
    └── routes/          # по файлу на раздел: auth, contacts, incidents, sos, alerts, ...
alembic/                 # миграции (async env)
tests/                   # pytest + httpx.AsyncClient, отдельная база safe_city_test
```

## Договорённости
- **JSON в camelCase** через `CamelModel` (alias_generator=to_camel, populate_by_name).
  В Python — snake_case.
- **Время** — `timestamptz`, в API ISO 8601 с часовым поясом (UTC).
- **Идентификаторы** — целые числа (`id: 1048`). Вид «#1048» рисует фронт.
- **Ошибки** — стандартный FastAPI `{"detail": "..."}` с понятным русским текстом;
  коды: 400 (неверные данные), 401 (нет/просрочен токен), 403 (нет прав), 404, 409 (конфликт),
  422 (валидация).
- **Авторизация** — заголовок `Authorization: Bearer <JWT>`; в токене `sub` = id пользователя.
- **Роуты тонкие**: валидация (схема) → сервис → ответ (схема).
- **Миграции** — только через Alembic (`alembic revision --autogenerate`), каждая
  миграция просматривается глазами перед коммитом.
- **Координаты** — `lat`, `lng` (float). Расстояние считаем по формуле гаверсинуса в Python
  (PostGIS для MVP не нужен).
