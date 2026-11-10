# Соглашения: стиль, коммиты, тесты, запуск

## Запуск (Windows/macOS/Linux)
```bash
docker compose up -d db                 # PostgreSQL на localhost:5433 (+ база safe_city_test)
cd backend
cp .env.example .env                    # один раз
uv sync                                 # зависимости
uv run alembic upgrade head             # миграции
uv run python -m app.cli seed-places    # точки карты Москвы (можно запускать повторно)
uv run uvicorn app.main:app --reload    # http://localhost:8000/docs
```
Фронт: `cd frontend && npm ci && npm run dev` → http://localhost:5173

Вход в dev: код подтверждения всегда `0000` (смотрите строку `[SMS MOCK]` в логе сервера).
Сделать пользователя модератором:
```bash
uv run python -m app.cli set-role +79123456789 moderator
```
В Swagger: выполнить `POST /api/auth/verify`, скопировать `accessToken`, нажать **Authorize**.

## Стиль кода
- **Python** — ruff (линтер + форматтер), правила в `backend/pyproject.toml`, длина строки 100,
  двойные кавычки, сортировка импортов. Аннотации типов у всех функций.
- **JS/JSX** — Prettier (`frontend/.prettierrc.json`: одинарные кавычки, `;`, ширина 100)
  + ESLint (`frontend/eslint.config.js`).
- Общие правила — `.editorconfig`: UTF-8, LF, отступ 2 (Python — 4), перевод строки в конце.
- Тексты для пользователя (ошибки, сообщения) — на русском; код, имена — на английском.

## pre-commit
Установка один раз после клонирования:
```bash
cd backend && uv sync && uv run pre-commit install
cd ../frontend && npm ci
```
Хуки на каждый коммит: пробелы/концы строк, yaml/toml/json, ruff, ruff-format, prettier, eslint,
проверка формата сообщения. Прогон вручную: `uv run --directory backend pre-commit run --all-files`.
Хуки **не обходить** (`--no-verify` нельзя) — исправить причину.

## Коммиты — Conventional Commits
`<тип>(<область>): <что сделано>` — описание по-русски, в повелительном/назывном виде.
Типы: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Области: `backend`, `frontend`, `auth`, `contacts`, `incidents`, `sos`, `alerts`, `moderation`,
`agents`, `ci`.
Примеры: `feat(auth): вход по телефону и коду`, `test(contacts): лимит в 5 контактов`.

## Тесты
- `cd backend && uv run pytest -q` (нужен запущенный `docker compose up -d db`).
- Тесты всегда ходят в базу `safe_city_test` (conftest принудительно подменяет `DATABASE_URL`);
  схема пересоздаётся на прогон, таблицы очищаются после каждого теста.
- На каждый эндпоинт: успешный сценарий + основные ошибки (401/403/404/409/422).
- Ручная проверка в браузере после каждого этапа (см. `06-roadmap.md`).
