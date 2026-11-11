# API-контракт

Базовый URL: `http://localhost:8000/api`. Swagger: `http://localhost:8000/docs`.

Колонка «Доступ»:
- **все** — без токена;
- **вход** — нужен заголовок `Authorization: Bearer <токен>`;
- **модератор** — нужен токен пользователя с ролью `moderator`.

## Соответствие функциям `frontend/src/services/api.js`

| Функция api.js | Эндпоинт бэкенда | Этап |
|---|---|---|
| `registerUser` | `POST /auth/register` (на 409 — `POST /auth/login`), затем `POST /auth/verify` | 1 |
| `loginUser` | `POST /auth/login` (режим «Вход» на экране регистрации) | 8 |
| `getDashboardData` | `GET /dashboard` (агрегат) | 8 |
| `verifyCode` (новая) | `POST /auth/verify`, токен в `localStorage` | 8 |
| `togglePushNotifications` | `PATCH /user/notifications` | 1 |
| `addEmergencyContact`, `toggleContactSos`, `deleteEmergencyContact` | `POST /contacts`, `PATCH /contacts/{id}`, `DELETE /contacts/{id}` | 3 |
| `submitIncidentReport` | `POST /incidents` + `POST /incidents/{id}/photos` | 4 |
| `sendSosSignal`, `cancelSosSignal` | `POST /sos` (сразу, координаты досылаются `POST /sos/{id}/location`), `POST /sos/{id}/cancel` | 5 |
| `getSosSignal` | `GET /sos/{id}` — чем закончился сигнал | 5 |
| `uploadIncidentPhotos` | `POST /incidents/{id}/photos` по одному файлу | 4 |
| `updateCityAlert` | `PATCH /alerts/{id}` | 6 |
| `resolveSos` | `POST /moderation/sos/{id}/resolve` | 7 |
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
| `POST /auth/login` | все | `{phone}` | `{step: 2, smsSent: true, phone}`; 404, если номера нет (или он не подтверждён) |
| `POST /auth/verify` | все | `{phone, code}` | `{accessToken, tokenType: "bearer", user}`; 400 неверный/просроченный код, 429 много попыток |

Лимиты (решение 71): `register`/`login` — 429 с заголовком `Retry-After`, если код на этот номер
запрашивали меньше минуты назад, больше 5 раз за час или с этого IP больше 30 раз за час; `verify` —
429 после 5 неверных попыток на код или 10 на номер за час. В prod без SMS-провайдера `register`/`login` — 503.
Пользователь создаётся при первом успешном `verify`.
Ошибки 422 — `{"detail": [{type, loc, msg}]}`, `msg` по-русски: «Имя: не короче 2 символов».
| `GET /users/me` | вход | — | `user` |
| `PATCH /users/me` | вход | любые из `{name, city, geolocationEnabled, pushNotificationsEnabled, lastLat, lastLng, lastAddress}` | `user` |
| `PATCH /user/notifications` | вход | `{pushNotificationsEnabled}` | `user` (путь как в api.js) |

`user` = `{id, phone, name, city, role, geolocationEnabled, pushNotificationsEnabled, lastLat, lastLng, lastAddress, phoneVerifiedAt, createdAt}`.
`lastLat` и `lastLng` в `PATCH /users/me` передаются только вместе (обе `null` — стереть), иначе 422.

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
`photos[]` = `{id, url: "/media/...", contentType, sizeBytes}` (автору и модератору — `url` с `?key=...`:
по такой ссылке фото открывается и у скрытой метки; без подписи фото скрытой метки — 404);
`responses` — список откликов только автору, остальным `null` (телефон — только у действующих откликов);
`response` = `{id, incidentId, user: {id, name, phone}, message, status, createdAt}` (`phone` — только автору метки).

`POST /incidents`: `lat`/`lng` необязательны — тогда берётся последнее местоположение пользователя.
Точка вне России (например, `0, 0`) — 400.
`PATCH /incidents/{id}`: `{description?, address?, status?: "closed"}`.
Ошибки фото: 400 — не JPG/PNG/WebP или файл битый, 413 — больше 5 МБ (или запрос больше 25 МБ),
409 — больше 4 на метку, 403 — не автор. Фото пересохраняются без EXIF (GPS, модель телефона).

| Метод и путь | Доступ | Ответ |
|---|---|---|
| `GET /media/{путь}` (без `/api`) | все; у скрытой метки — по подписанной ссылке | файл фото, `Cache-Control: private, max-age=300` |

## SOS (этап 5)

| Метод и путь | Доступ | Тело запроса | Ответ |
|---|---|---|---|
| `POST /sos` | вход | `{lat?, lng?, address?, accuracyMeters?}` | `sos`, 201 (или 200, если сигнал уже активен) |
| `GET /sos/active` | вход | — | активный сигнал или `null` |
| `POST /sos/{id}/cancel` | вход | — | сигнал |
| `POST /sos/active/cancel` | вход | — | отменить текущий активный сигнал |
| `GET /sos/{id}` | вход | — | свой сигнал, в том числе завершённый; чужой — 404 |
| `POST /sos/{id}/location` | вход | `{lat, lng, address?, accuracyMeters?}` | сигнал; 409, если он уже завершён (новый не создаётся) |

`sos` = `{id, status, lat, lng, address, accuracyMeters, startedAt, endedAt, notifiedContacts}`,
`notifiedContacts[]` = `{id, contactId, name, relation, phone, channel, status}`, `status` доставки —
`sending`/`delivered`/`failed`. Все поля `POST /sos` необязательны; при активном сигнале ответ 200
(обновлено местоположение), иначе 201. Отмена: 404 — нет/чужой, 409 — уже завершён.

## Оповещения (этап 6)

| Метод и путь | Доступ | Тело / параметры | Ответ |
|---|---|---|---|
| `GET /alerts` | все | `level`, `includeUnpublished` | лента; `includeUnpublished=true` — только модератору (иначе 403) |
| `GET /alerts/{id}` | все | — | оповещение (снятое с публикации — только модератору) |
| `POST /alerts` | модератор | `{title, subtitle?, description, level?, locationLabel?, sourceLabel?, actionsChecklist?, isPublished?}` | оповещение, 201 |
| `PATCH /alerts/{id}` | модератор | любые поля оповещения, `isPublished` | оповещение |

В `PATCH /alerts/{id}` `subtitle`/`sourceLabel` со значением `null` или `""` стираются,
`locationLabel: null` — «Весь город», `null` у остальных полей игнорируется.

`alert` = `{id, title, subtitle, description, level, locationLabel, sourceLabel, actionsChecklist, isPublished, createdAt, updatedAt}`.
Параметры `GET /alerts`: `level` (можно повторять), `limit` (1–200, по умолчанию 50).

## Панель модератора (этап 7)

| Метод и путь | Доступ | Тело / параметры | Ответ |
|---|---|---|---|
| `GET /moderation/incidents` | модератор | `status`, `type` (можно повторять), `limit` | все метки, включая скрытые, с автором и `moderatorNote` |
| `PATCH /moderation/incidents/{id}` | модератор | `{status, moderatorNote?}` | метка |
| `GET /moderation/sos` | модератор | `status` (по умолчанию `active`), `limit` | SOS-сигналы с `user: {id, name, phone}` |
| `POST /moderation/sos/{id}/resolve` | модератор | — | сигнал со статусом `resolved`; 409, если уже завершён |
| `GET /moderation/stats` | модератор | — | `{newIncidents, inProgress, hidden, activeSos, avgReactionMinutes, avgReactionMinutesPrev}` |

## Агрегат (этап 8)

| Метод и путь | Доступ | Ответ |
|---|---|---|
| `GET /dashboard` | все (с токеном — плюс личные данные) | `{isAuthenticated, user, reference, alerts, places, incidents, contacts, activeSos, moderation}` |

`user` и `activeSos` — `null` у гостя, `contacts` — пустой список; `moderation` = `{incidents, activeSos, stats, alerts}`
(`alerts` — все оповещения, включая снятые с публикации)
только модератору. Форму `getDashboardData` из ответа собирает `adaptDashboard` в `frontend/src/services/adapters.js`.
