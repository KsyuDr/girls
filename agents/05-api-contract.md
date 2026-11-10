# API-контракт

Базовый URL: `http://localhost:8000/api`. Swagger: `http://localhost:8000/docs`.
🔓 — без токена, 🔑 — нужен токен, 🛡 — нужна роль `moderator`.

## Соответствие функциям `frontend/src/services/api.js`

| функция api.js | эндпоинт бэкенда | этап |
|---|---|---|
| `registerUser` | `POST /auth/register` → `POST /auth/verify` | 1 |
| `getDashboardData` | `GET /dashboard` (агрегат) или по частям ниже | 8 |
| `togglePushNotifications` | `PATCH /user/notifications` 🔑 | 1 |
| `addEmergencyContact` / `toggleContactSos` / `deleteEmergencyContact` | `POST/PATCH/DELETE /contacts[/{id}]` 🔑 | 3 |
| `submitIncidentReport` | `POST /incidents` 🔑 + `POST /incidents/{id}/photos` 🔑 | 4 |
| `sendSosSignal` / `cancelSosSignal` | `POST /sos` 🔑, `POST /sos/{id}/cancel` 🔑 | 5 |
| `createCityAlert` | `POST /alerts` 🛡 | 6 |
| `updateIncidentStatus` | `PATCH /moderation/incidents/{id}` 🛡 | 7 |

## Эндпоинты

### Служебное
- `GET /health` 🔓 → `{status, database, version}` ✅ этап 0

### Авторизация и профиль (этап 1)
- `POST /auth/register` 🔓 `{name, phone, city, geolocationEnabled}` → `{step: 2, smsSent: true}`
  (409, если телефон уже подтверждён — тогда вход)
- `POST /auth/login` 🔓 `{phone}` → `{step: 2, smsSent: true}` (404, если нет такого)
- `POST /auth/verify` 🔓 `{phone, code}` → `{accessToken, tokenType: "bearer", user}`
- `GET /users/me` 🔑 → `user`
- `PATCH /users/me` 🔑 `{name?, city?, geolocationEnabled?, lastLat?, lastLng?, lastAddress?}`
- `PATCH /user/notifications` 🔑 `{pushNotificationsEnabled}` → `user` (совместимость с api.js)

### Справочники (этап 2)
- `GET /reference` 🔓 → `{services, guides, incidentTypes, mapCategories, cities, sosWaitingTips, reportNextSteps, maxContacts}`
- `GET /places?category=&lat=&lng=` 🔓 → точки карты (+ `distanceMeters`, если переданы координаты)

### Экстренные контакты (этап 3)
- `GET /contacts` 🔑, `POST /contacts` 🔑 `{name, relation, phone, receivesSos}` (409 при >5),
  `PATCH /contacts/{id}` 🔑, `DELETE /contacts/{id}` 🔑 (204)

### Метки (этап 4)
- `GET /incidents?type=&status=&lat=&lng=&radius=&mine=` 🔓 (скрытые не отдаются)
- `GET /incidents/{id}` 🔓
- `POST /incidents` 🔑 `{type, description, address, lat, lng, isAnonymous}`
- `POST /incidents/{id}/photos` 🔑 multipart `files[]` (≤4, ≤5 МБ, jpg/png/webp)
- `PATCH /incidents/{id}` 🔑 автор: описание / закрыть
- `POST /incidents/{id}/responses` 🔑 «Помогу» `{message?}`; `DELETE /incidents/{id}/responses/me` 🔑

### SOS (этап 5)
- `POST /sos` 🔑 `{lat, lng, address, accuracyMeters}` → `{id, status, startedAt, notifiedContacts[], ...}`
- `GET /sos/active` 🔑 → активный сигнал или `null`
- `POST /sos/{id}/cancel` 🔑

### Оповещения (этап 6)
- `GET /alerts?level=` 🔓
- `POST /alerts` 🛡 `{title, subtitle?, description, level, locationLabel?, sourceLabel?, actionsChecklist?}`

### Панель модератора (этап 7)
- `GET /moderation/incidents?status=` 🛡 (включая скрытые)
- `PATCH /moderation/incidents/{id}` 🛡 `{status, moderatorNote?}`
- `GET /moderation/sos?status=active` 🛡
- `GET /moderation/stats` 🛡 → `{newIncidents, inProgress, activeSos, avgReactionMinutes}`

### Агрегат (этап 8)
- `GET /dashboard` 🔓/🔑 → всё, что нужно `App.jsx` при старте (форма как в `getDashboardData`)
