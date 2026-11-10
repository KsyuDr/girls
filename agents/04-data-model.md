# Модель данных (черновик MVP)

Поля `created_at` / `updated_at` есть у всех таблиц (TimestampMixin). Перечисления
храним как `varchar` + проверку в Pydantic (проще миграции, чем PG enum).

## users
| поле | тип | примечание |
|---|---|---|
| id | int PK | |
| phone | varchar(20) unique | нормализованный `+79123456789` |
| name | varchar(100) | «Полина Исупова» |
| city | varchar(60) | из списка городов справочника |
| role | varchar(20) | `user` \| `moderator` |
| geolocation_enabled | bool | |
| push_notifications_enabled | bool | |
| phone_verified_at | timestamptz null | заполняется после ввода кода |
| last_lat, last_lng | float null | последнее известное местоположение |
| last_address | varchar(200) null | |

## auth_codes — одноразовые коды входа
| id | phone | code_hash | expires_at | attempts | used_at | ip | name | city | geolocation_enabled |
Код живёт 5 минут, максимум 5 неверных попыток на код и 10 на номер за час. В dev/test код =
`SMS_MOCK_CODE`, в prod — 6 цифр. `ip` — для лимита выдачи кодов. `name`/`city`/`geolocation_enabled` —
анкета регистрации, применяется к пользователю при вводе кода (у кода входа — null).
Строка `users` появляется только после подтверждения номера.

## emergency_contacts
| id | user_id FK | name | relation («Мама») | phone | receives_sos bool | notify_method (`sms`/`sms_push`) | position |
Не больше 5 на пользователя (проверка в сервисе → 409).

## incidents — метки жителей на карте
| поле | тип | примечание |
|---|---|---|
| id | int PK | на фронте «#1048» |
| author_id | FK users | есть всегда; при `is_anonymous` наружу не отдаём |
| type | varchar | `fire`, `accident`, `threat`, `flood`, `gas`, `other`, `help_needed`, `lost`, `found` |
| description | text | |
| address | varchar(200) | |
| lat, lng | float | |
| is_anonymous | bool | |
| status | varchar | `new` → `in_progress` → `closed`; `hidden` — скрыта модератором |
| moderator_note | text null | |
| closed_at | timestamptz null | |
| reacted_at | timestamptz null | первая смена статуса модератором — для «времени реакции» |

## incident_photos
| id | incident_id FK | file_path | content_type | size_bytes |

## incident_responses — отклик «Помогу» / «Нашёл»
| id | incident_id FK | user_id FK | message | status (`active`/`cancelled`/`done`) |
Уникальность (incident_id, user_id). Нельзя откликаться на свою метку.

## sos_signals
| id | user_id FK | lat | lng | address | accuracy_m | status (`active`/`cancelled`/`resolved`) | ended_at |
У пользователя не больше одного активного SOS (частичный уникальный индекс). `lat`/`lng` могут быть null.

## sos_deliveries — кому ушёл SOS (в MVP доставка имитируется)
| id | sos_id FK | contact_id FK null (SET NULL) | contact_name | contact_relation | contact_phone | channel | status (`sending`/`delivered`/`failed`) |
Имя и номер копируются из контакта — история не теряется при его удалении.

## alerts — лента оповещений
| id | title | subtitle | description | level (`critical`/`warning`/`info`) | location_label | source_label | actions_checklist jsonb (список строк) | author_id FK | is_published |

## places — справочные точки карты (сид-данные)
| id | title | category (`shelter`/`hospital`/`police`/`danger`) | address | lat | lng | hours_label | phone | is_open |
Уникальность (title, address) — по ней сид не дублирует точки. Сид Москвы: `app/reference/places_seed.py`.
