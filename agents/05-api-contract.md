# API-контракт

Базовый URL: `http://localhost:8000/api`. Swagger: `http://localhost:8000/docs`.

Колонка «Доступ»:
- **все** — без токена;
- **вход** — нужен заголовок `Authorization: Bearer <токен>`;
- **модератор** — нужен токен пользователя с ролью `moderator`.

## Соответствие функциям `frontend/src/services/api.js`

| Функция api.js | Эндпоинт бэкенда | Этап |
|---|---|---|
| `registerUser` | `POST /auth/register`, затем `POST /auth/verify` | 1 |
| `getDashboardData` | `GET /dashboard` (агрегат) или по частям ниже | 8 |
| `togglePushNotifications` | `PATCH /user/notifications` | 1 |
| `addEmergencyContact`, `toggleContactSos`, `deleteEmergencyContact` | `POST /contacts`, `PATCH /contacts/{id}`, `DELETE /contacts/{id}` | 3 |
| `submitIncidentReport` | `POST /incidents` + `POST /incidents/{id}/photos` | 4 |
| `sendSosSignal`, `cancelSosSignal` | `POST /sos`, `POST /sos/{id}/cancel` | 5 |
| `createCityAlert` | `POST /alerts` | 6 |
| `updateIncidentStatus` | `PATCH /moderation/incidents/{id}` | 7 |

## Служебное (этап 0, готово)

| Метод и путь | Доступ | Тело запроса | Ответ |
|---|---|---|---|
| `GET /health` | все | — | `{status, database, version}` |

## Вход и профиль (этап 1)

| Метод и путь | Доступ | Тело запроса | Ответ |
|---|---|---|---|
| `POST /auth/register` | все | `{name, phone, city, geolocationEnabled}` | `{step: 2, smsSent: true, phone}`; 409, если номер уже подтверждён |
| `POST /auth/login` | все | `{phone}` | `{step: 2, smsSent: true, phone}`; 404, если номера нет |
| `POST /auth/verify` | все | `{phone, code}` | `{accessToken, tokenType: "bearer", user}`; 400 неверный/просроченный код, 429 много попыток |
| `GET /users/me` | вход | — | `user` |
| `PATCH /users/me` | вход | любые из `{name, city, geolocationEnabled, pushNotificationsEnabled, lastLat, lastLng, lastAddress}` | `user` |
| `PATCH /user/notifications` | вход | `{pushNotificationsEnabled}` | `user` (путь как в api.js) |

`user` = `{id, phone, name, city, role, geolocationEnabled, pushNotificationsEnabled, lastLat, lastLng, lastAddress, phoneVerifiedAt, createdAt}`.

## Справочники (этап 2)

| Метод и путь | Доступ | Параметры | Ответ |
|---|---|---|---|
| `GET /reference` | все | — | `{services, guides, incidentTypes, mapCategories, cities, sosWaitingTips, reportNextSteps, maxContacts}` |
| `GET /places` | все | `category` (можно повторять), `lat` + `lng` (только вместе, иначе 400) | список `place`; с координатами — по близости |

`place` = `{id, title, category, address, lat, lng, hoursLabel, phone, isOpen, distanceMeters}`;
`category` — `shelter`/`hospital`/`police`/`danger`; `distanceMeters` — целые метры или `null`.

Элементы справочника:
- `services[]` = `{id, name, shortName, description, number, icon, bgColor, iconColor, showOnMobileHome}`;
- `guides[]` = `{id, title, detailTitle, source, readMinutes, icon, emergencyNumber, callBannerTitle, callBannerSubtitle, showOnMobilePreview, steps[], donts[]}`;
- `incidentTypes[]` = `{id, label, icon, group, hint}`, `group` — `danger`/`help`/`lost_found`;
- `mapCategories[]` = `{id, label, dotColor}`; `reportNextSteps[]` = `{id, title, subtitle}`;
- `cities`, `sosWaitingTips` — списки строк.

Отличия от моков, которые закроют адаптеры `api.js` на этапе 8: у памяток нет
`stepsCountLabel`/`metaSubtitle`, у типов меток `defaultService` стал `hint`, у точек карты нет
готовых `distanceLabel`, `walkTimeLabel`, цветов и позиций на картинке.

## Экстренные контакты (этап 3)

| Метод и путь | Доступ | Тело запроса | Ответ |
|---|---|---|---|
| `GET /contacts` | вход | — | список контактов |
| `POST /contacts` | вход | `{name, relation?, phone, receivesSos?, notifyMethod?}` | контакт; 409, если уже 5 |
| `PATCH /contacts/{id}` | вход | любые поля контакта | контакт |
| `DELETE /contacts/{id}` | вход | — | 204 |

`contact` = `{id, name, relation, phone, receivesSos, notifyMethod, position, createdAt}`.
`POST` отвечает 201; 409 — уже 5 контактов или номер уже есть; 400 — свой номер;
404 — контакт не найден или чужой. В `PATCH` null для поля игнорируется.

## Метки (этап 4)

| Метод и путь | Доступ | Тело / параметры | Ответ |
|---|---|---|---|
| `GET /incidents` | все | `type`, `status`, `lat`, `lng`, `radius`, `mine`, `limit` | список (скрытые не отдаются) |
| `GET /incidents/{id}` | все | — | метка |
| `POST /incidents` | вход | `{type, description, address, lat?, lng?, isAnonymous?}` | метка, 201 |
| `POST /incidents/{id}/photos` | вход | multipart `files` (до 4, до 5 МБ, jpg/png/webp) | список фото |
| `PATCH /incidents/{id}` | вход (автор) | описание или закрыть | метка |
| `POST /incidents/{id}/responses` | вход | `{message?}` — отклик «Помогу» | отклик |
| `DELETE /incidents/{id}/responses/me` | вход | — | 204 |

Параметры `GET /incidents`: `type` и `status` (можно повторять; `status` — `new`/`in_progress`/`closed`),
`lat` + `lng`, `radius` (метры, нужны координаты), `mine=true` (нужен вход), `limit` (1–500, по умолчанию 100).
`GET /incidents/{id}` тоже принимает `lat` + `lng`. Токен необязателен, но неверный — 401.

`incident` = `{id, type, description, address, lat, lng, isAnonymous, status, author, isMine, photos,
responsesCount, myResponse, responses, distanceMeters, createdAt, updatedAt, closedAt}`, где
`author` = `{id, name: "Полина И.", phone: null}` или `null` у анонимной метки;
`photos[]` = `{id, url: "/media/...", contentType, sizeBytes}`;
`responses` — список откликов только автору, остальным `null`;
`response` = `{id, incidentId, user: {id, name, phone}, message, status, createdAt}` (`phone` — только автору метки).

`POST /incidents`: `lat`/`lng` необязательны — тогда берётся последнее местоположение пользователя.
`PATCH /incidents/{id}`: `{description?, address?, status?: "closed"}`.
Ошибки фото: 400 — не JPG/PNG/WebP, 413 — больше 5 МБ, 409 — больше 4 на метку, 403 — не автор.

## SOS (этап 5)

| Метод и путь | Доступ | Тело запроса | Ответ |
|---|---|---|---|
| `POST /sos` | вход | `{lat, lng, address, accuracyMeters}` | `{id, status, startedAt, notifiedContacts, ...}` |
| `GET /sos/active` | вход | — | активный сигнал или `null` |
| `POST /sos/{id}/cancel` | вход | — | сигнал |

## Оповещения (этап 6)

| Метод и путь | Доступ | Тело / параметры | Ответ |
|---|---|---|---|
| `GET /alerts` | все | `level` | лента |
| `POST /alerts` | модератор | `{title, subtitle?, description, level, locationLabel?, sourceLabel?, actionsChecklist?}` | оповещение |

## Панель модератора (этап 7)

| Метод и путь | Доступ | Тело / параметры | Ответ |
|---|---|---|---|
| `GET /moderation/incidents` | модератор | `status` | все метки, включая скрытые |
| `PATCH /moderation/incidents/{id}` | модератор | `{status, moderatorNote?}` | метка |
| `GET /moderation/sos` | модератор | `status=active` | SOS-сигналы |
| `GET /moderation/stats` | модератор | — | `{newIncidents, inProgress, activeSos, avgReactionMinutes}` |

## Агрегат (этап 8)

| Метод и путь | Доступ | Ответ |
|---|---|---|
| `GET /dashboard` | все (с токеном — плюс личные данные) | всё, что нужно `App.jsx` при старте, в форме `getDashboardData` |
