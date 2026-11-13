import {
  INITIAL_USER,
  EMERGENCY_SERVICES,
  RECENT_ALERTS,
  SAFETY_GUIDES,
  EMERGENCY_CONTACTS,
  MAX_EMERGENCY_CONTACTS,
  SOS_WAITING_TIPS,
  MAP_FILTER_CATEGORIES,
  MAP_PLACES,
  INCIDENT_TYPES,
  REPORT_NEXT_STEPS,
  INITIAL_OPERATOR_INCIDENTS,
  OPERATOR_PROFILE,
} from '../mock/data';
import {
  ALERT_LEVEL_CONFIG,
  adaptAlert,
  adaptContact,
  adaptDashboard,
  adaptOperatorIncident,
  adaptSos,
  adaptUser,
} from './adapters';

/**
 * Единый сервисный слой для работы с бэкендом (FastAPI, backend/).
 * VITE_USE_MOCK=false — работаем с сервером (см. frontend/.env.development),
 * иначе — с моками из src/mock/data.js и localStorage. Компоненты одинаковы в обоих режимах:
 * ответы сервера приводятся к форме моков в ./adapters.js.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const STORAGE_USER_KEY = 'safe_city_user';
const STORAGE_CONTACTS_KEY = 'safe_city_contacts';
const STORAGE_INCIDENTS_KEY = 'safe_city_incidents';
const STORAGE_ALERTS_KEY = 'safe_city_alerts';
const STORAGE_TOKEN_KEY = 'safe_city_token';

const AVATAR_PALETTE = ['#007DA5', '#003C54', '#008F82', '#00C9B7'];

// ---------- HTTP-клиент ----------

function getToken() {
  try {
    return localStorage.getItem(STORAGE_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(STORAGE_TOKEN_KEY, token);
    else localStorage.removeItem(STORAGE_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

export function logout() {
  setToken(null);
}

/** Ошибка API: message — текст для пользователя из поля detail. */
export class ApiError extends Error {
  constructor(status, message, detail, retryAfter = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter; // секунды из заголовка Retry-After (429)
  }
}

function errorMessage(detail, fallback) {
  if (typeof detail === 'string') return detail;
  // 422 от FastAPI: список ошибок валидации
  if (Array.isArray(detail) && detail[0]?.msg) {
    return detail[0].msg.replace(/^Value error, /, '');
  }
  return fallback;
}

async function request(path, { method = 'GET', body, form, fallback = 'Ошибка запроса' } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form; // multipart: Content-Type с boundary поставит браузер
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз');
  }
  if (response.status === 401) setToken(null); // сессия истекла — дальше работаем как гость

  if (!response.ok) {
    let detail;
    try {
      detail = (await response.json()).detail;
    } catch {
      detail = undefined;
    }
    const retryAfter = Number(response.headers?.get?.('Retry-After')) || null;
    throw new ApiError(response.status, errorMessage(detail, fallback), detail, retryAfter);
  }
  if (response.status === 204) return null;
  return response.json();
}

/**
 * Текущие координаты браузера: {position} или {error}, где error — 'denied' (запретили),
 * 'unavailable' (нет GPS/сети, нет API) или 'timeout'.
 */
export function locate(timeoutMs = 4000) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ error: 'unavailable' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          position: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: Math.round(pos.coords.accuracy),
          },
        }),
      (err) =>
        resolve({
          error: err?.code === 1 ? 'denied' : err?.code === 3 ? 'timeout' : 'unavailable',
        }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

/** То же, но только координаты; null, если определить не удалось. */
async function getBrowserPosition(timeoutMs = 4000) {
  return (await locate(timeoutMs)).position ?? null;
}

/** Подсказка пользователю, что делать, если место определить не удалось. */
export const LOCATION_HELP = {
  denied:
    'Доступ к геолокации запрещён. Разрешите его в настройках браузера (значок замка слева от адреса сайта) и нажмите кнопку ещё раз',
  unavailable:
    'Не удалось определить местоположение. Проверьте GPS и интернет и попробуйте ещё раз',
  timeout:
    'Местоположение определяется слишком долго. Выйдите на открытое место и попробуйте ещё раз',
};

async function fetchContacts() {
  const [contacts, active] = await Promise.all([request('/contacts'), request('/sos/active')]);
  return contacts.map((c, i) => adaptContact(c, i, active));
}

async function fetchOperatorIncidents() {
  const [incidents, reference] = await Promise.all([
    request('/moderation/incidents'),
    request('/reference'),
  ]);
  const typesById = Object.fromEntries(reference.incidentTypes.map((t) => [t.id, t]));
  return incidents.map((i) => adaptOperatorIncident(i, typesById));
}

// ---------- моки (localStorage) ----------

function getStoredIncidents() {
  try {
    const raw = localStorage.getItem(STORAGE_INCIDENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return INITIAL_OPERATOR_INCIDENTS;
}

function saveStoredIncidents(incidents) {
  try {
    localStorage.setItem(STORAGE_INCIDENTS_KEY, JSON.stringify(incidents));
  } catch {
    // ignore storage errors
  }
}

function getStoredAlerts() {
  try {
    const raw = localStorage.getItem(STORAGE_ALERTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return RECENT_ALERTS;
}

function saveStoredAlerts(alerts) {
  try {
    localStorage.setItem(STORAGE_ALERTS_KEY, JSON.stringify(alerts));
  } catch {
    // ignore storage errors
  }
}

function getStoredContacts() {
  try {
    const raw = localStorage.getItem(STORAGE_CONTACTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c, idx) => ({
          ...c,
          receivesSos:
            typeof c.receivesSos === 'boolean'
              ? c.receivesSos
              : (EMERGENCY_CONTACTS[idx]?.receivesSos ?? true),
        }));
      }
    }
  } catch {
    // ignore storage errors
  }
  return EMERGENCY_CONTACTS;
}

function saveStoredContacts(contacts) {
  try {
    localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(contacts));
  } catch {
    // ignore storage errors
  }
}

// ---------- вход ----------

/**
 * Шаг 1: отправить код. Если номер уже зарегистрирован, сервер отвечает 409 —
 * тогда это вход, и код запрашиваем через /auth/login. Возвращает {step: 2, phone}.
 * В режиме моков сразу возвращает {user} без шага кода.
 */
export async function registerUser(payload) {
  if (!USE_MOCK) {
    const body = {
      name: payload.name.trim(),
      phone: payload.phone,
      city: payload.city,
      geolocationEnabled: Boolean(payload.geolocationEnabled),
    };
    // 409 («номер уже зарегистрирован») не превращаем во вход молча: введённое имя
    // отбросилось бы. RegisterPage покажет ошибку и предложит войти.
    return request('/auth/register', {
      method: 'POST',
      body,
      fallback: 'Ошибка при регистрации пользователя',
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 200));

  const trimmedName = payload.name.trim();
  const parts = trimmedName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || INITIAL_USER.firstName;
  const initials =
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || INITIAL_USER.initials;

  const updatedUser = {
    ...INITIAL_USER,
    name: trimmedName || INITIAL_USER.name,
    mobileName: trimmedName || INITIAL_USER.mobileName,
    firstName,
    initials,
    phone: payload.phone.trim() || INITIAL_USER.phone,
    displayPhone: payload.phone.trim() || INITIAL_USER.displayPhone,
    city: payload.city || INITIAL_USER.city,
    geolocationEnabled: Boolean(payload.geolocationEnabled),
  };

  try {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
  } catch {
    // ignore storage errors
  }

  return { user: updatedUser, step: 2, smsSent: true };
}

/** Вход существующего пользователя: отправить код на номер. Возвращает {step: 2, phone}. */
export async function loginUser(phone) {
  if (USE_MOCK) return { user: INITIAL_USER };
  return request('/auth/login', {
    method: 'POST',
    body: { phone },
    fallback: 'Не удалось отправить код',
  });
}

/** Шаг 2: проверить код из SMS, сохранить токен. Возвращает {user}. */
export async function verifyCode(phone, code) {
  if (USE_MOCK) {
    return { user: INITIAL_USER };
  }
  const result = await request('/auth/verify', {
    method: 'POST',
    body: { phone, code: code.trim() },
    fallback: 'Неверный код',
  });
  setToken(result.accessToken);

  // Если пользователь разрешил геолокацию — сразу сохраним местоположение для SOS и карты
  if (result.user.geolocationEnabled) {
    const position = await getBrowserPosition();
    if (position) {
      const updated = await request('/users/me', {
        method: 'PATCH',
        body: { lastLat: position.lat, lastLng: position.lng },
      }).catch(() => null);
      if (updated) return { user: adaptUser(updated) };
    }
  }
  return { user: adaptUser(result.user) };
}

// ---------- данные приложения ----------

export async function getDashboardData() {
  if (!USE_MOCK) {
    try {
      return adaptDashboard(await request('/dashboard'));
    } catch (error) {
      if (error.status !== 401) throw error;
      // Токен протух — request() его уже удалил, грузим гостевые данные
      return adaptDashboard(await request('/dashboard'));
    }
  }

  let storedUser = null;
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (raw) storedUser = JSON.parse(raw);
  } catch {
    storedUser = null;
  }

  return {
    user: storedUser ? { ...INITIAL_USER, ...storedUser } : INITIAL_USER,
    services: EMERGENCY_SERVICES,
    alerts: getStoredAlerts(),
    guides: SAFETY_GUIDES,
    contacts: getStoredContacts(),
    maxContacts: MAX_EMERGENCY_CONTACTS,
    sosWaitingTips: SOS_WAITING_TIPS,
    mapCategories: MAP_FILTER_CATEGORIES,
    mapPlaces: MAP_PLACES,
    incidentTypes: INCIDENT_TYPES,
    reportNextSteps: REPORT_NEXT_STEPS,
    operatorIncidents: getStoredIncidents(),
    operatorProfile: OPERATOR_PROFILE,
  };
}

// ---------- SOS ----------

// Отменённые в этой сессии сигналы: досылка координат не должна «воскресить» SOS
const cancelledSos = new Set();

/**
 * Отправить SOS. С бэкендом сигнал уходит сразу, не дожидаясь GPS: координаты браузера
 * определяются дальше и досылаются вторым запросом (onLocationUpdate получит обновлённый сигнал).
 */
export async function sendSosSignal(coordinates, { onLocationUpdate } = {}) {
  if (!USE_MOCK) {
    const body = {};
    if (
      coordinates?.address &&
      !['Местоположение неизвестно', 'Текущее местоположение'].includes(coordinates.address)
    ) {
      body.address = coordinates.address;
    }
    const sos = await request('/sos', {
      method: 'POST',
      body,
      fallback: 'Не удалось отправить сигнал SOS',
    });
    refineSosLocation(sos.id, onLocationUpdate);
    return adaptSos(sos);
  }

  await new Promise((resolve) => setTimeout(resolve, 200));
  const contacts = getStoredContacts().filter((c) => c.receivesSos);
  return {
    id: `sos_${Date.now()}`,
    status: 'active',
    startedAt: Date.now(),
    notifiedContacts: contacts,
    address: coordinates?.address || INITIAL_USER.address,
    coordinates: coordinates?.coordinates || INITIAL_USER.coordinates,
    accuracyMeters: coordinates?.accuracyMeters || INITIAL_USER.accuracyMeters,
  };
}

/**
 * Досылает координаты именно к этому сигналу. Сервер никогда не создаёт по этому запросу новый
 * SOS: если сигнал уже завершён (отменён на другом устройстве, «помощь пришла») — ответ 409.
 */
async function refineSosLocation(sosId, onLocationUpdate) {
  try {
    const position = await getBrowserPosition();
    if (!position || cancelledSos.has(sosId)) return;
    const updated = await request(`/sos/${sosId}/location`, { method: 'POST', body: position });
    onLocationUpdate?.(adaptSos(updated));
  } catch {
    // сигнал уже отправлен; потеря уточнения не критична, 409 — сигнал уже завершён
  }
}

/** Свой сигнал по id, в том числе завершённый: чем он закончился. null, если узнать не удалось. */
export async function getSosSignal(sosId) {
  if (USE_MOCK) return null;
  try {
    return adaptSos(await request(`/sos/${sosId}`));
  } catch {
    return null;
  }
}

export async function cancelSosSignal(sosId) {
  if (!USE_MOCK) {
    cancelledSos.add(sosId);
    try {
      const sos = await request(`/sos/${sosId || 'active'}/cancel`, {
        method: 'POST',
        fallback: 'Не удалось отменить сигнал SOS',
      });
      return adaptSos(sos);
    } catch (error) {
      cancelledSos.delete(sosId); // отмена не прошла — сигнал активен, досылку можно продолжать
      throw error;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 150));
  return { status: 'cancelled' };
}

/** Модератор: «помощь пришла» — завершить SOS жителя. */
export async function resolveSos(sosId) {
  return request(`/moderation/sos/${sosId}/resolve`, {
    method: 'POST',
    fallback: 'Не удалось завершить сигнал SOS',
  });
}

// ---------- экстренные контакты (возвращают весь список) ----------

export async function toggleContactSos(contactId, receivesSos) {
  if (!USE_MOCK) {
    await request(`/contacts/${contactId}`, {
      method: 'PATCH',
      body: { receivesSos: Boolean(receivesSos) },
      fallback: 'Не удалось обновить статус контакта',
    });
    return fetchContacts();
  }

  const currentContacts = getStoredContacts();
  const target = currentContacts.find((c) => c.id === contactId);
  const nextReceivesSos =
    typeof receivesSos === 'boolean' ? receivesSos : !(target?.receivesSos ?? false);

  const contacts = currentContacts.map((c) =>
    c.id === contactId ? { ...c, receivesSos: nextReceivesSos } : c
  );
  saveStoredContacts(contacts);
  return contacts;
}

export async function addEmergencyContact(payload) {
  if (!USE_MOCK) {
    await request('/contacts', {
      method: 'POST',
      body: {
        name: payload.name,
        relation: payload.relation,
        phone: payload.phone,
        receivesSos: payload.receivesSos ?? true,
      },
      fallback: 'Не удалось добавить контакт',
    });
    return fetchContacts();
  }

  const current = getStoredContacts();
  const parts = payload.name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'К';

  const newContact = {
    id: `cnt_${Date.now()}`,
    initials,
    name: payload.name.trim(),
    mobileShortLabel: payload.relation.trim() || parts[0] || payload.name.trim(),
    relation: payload.relation.trim() || 'Близкий',
    phone: payload.phone.trim(),
    avatarBg: AVATAR_PALETTE[current.length % AVATAR_PALETTE.length],
    receivesSos: payload.receivesSos ?? true,
    notifyMethod: 'SMS и push',
    sosDeliveryStatus: 'delivered',
    showOnMobileSos: true,
  };

  const updated = [...current, newContact];
  saveStoredContacts(updated);
  return updated;
}

export async function deleteEmergencyContact(contactId) {
  if (!USE_MOCK) {
    await request(`/contacts/${contactId}`, {
      method: 'DELETE',
      fallback: 'Не удалось удалить контакт',
    });
    return fetchContacts();
  }

  const updated = getStoredContacts().filter((c) => c.id !== contactId);
  saveStoredContacts(updated);
  return updated;
}

// ---------- профиль ----------

export async function togglePushNotifications(enabled) {
  if (!USE_MOCK) {
    const user = await request('/user/notifications', {
      method: 'PATCH',
      body: { pushNotificationsEnabled: Boolean(enabled) },
      fallback: 'Не удалось обновить настройки уведомлений',
    });
    return adaptUser(user);
  }

  let storedUser = INITIAL_USER;
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    if (raw) storedUser = { ...INITIAL_USER, ...JSON.parse(raw) };
  } catch {
    // ignore
  }

  const updatedUser = {
    ...storedUser,
    pushNotificationsEnabled: Boolean(enabled),
  };

  try {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
  } catch {
    // ignore
  }

  return updatedUser;
}

// ---------- метки ----------

/**
 * Отправить метку и приложить фото (payload.photoFiles — массив File).
 * Место: payload.coordinates ({lat, lng}) из формы, иначе координаты браузера, иначе последнее
 * известное место профиля (его подставит сервер).
 * Возвращает {incident: {id: '#1049', rawId}, failedPhotos?} — failedPhotos ([{file, message}]),
 * если метка создана, а часть фото нет.
 */
export async function submitIncidentReport(payload) {
  if (!USE_MOCK) {
    let point = payload.coordinates;
    let locateError = null;
    if (!point) {
      const located = await locate();
      point = located.position ?? null;
      locateError = located.error ?? null;
    }
    let incident;
    try {
      incident = await request('/incidents', {
        method: 'POST',
        body: {
          type: payload.typeId,
          description: payload.description?.trim(),
          address: payload.address?.trim(),
          isAnonymous: Boolean(payload.anonymous),
          ...(point ? { lat: point.lat, lng: point.lng } : {}),
        },
        fallback: 'Не удалось отправить обращение',
      });
    } catch (error) {
      if (error.status === 400 && /геолокаци/.test(error.message)) {
        const help = LOCATION_HELP[locateError] || LOCATION_HELP.unavailable;
        throw new ApiError(
          400,
          `Не удалось определить место. Отметьте точку на карте ниже. ${help}`,
          error.detail
        );
      }
      throw error;
    }

    const result = { incident: { id: `#${incident.id}`, rawId: incident.id } };
    // Метка уже создана: ошибка фото не повод отправлять форму ещё раз (будет дубль)
    const { failed } = await uploadIncidentPhotos(incident.id, payload.photoFiles || []);
    if (failed.length > 0) result.failedPhotos = failed;
    return result;
  }

  await new Promise((resolve) => setTimeout(resolve, 250));

  const currentIncidents = getStoredIncidents();
  const matchedType = INCIDENT_TYPES.find((t) => t.id === payload.typeId) || INCIDENT_TYPES[1];

  const numericIds = currentIncidents
    .map((inc) => parseInt(String(inc.id).replace(/\D/g, ''), 10))
    .filter((num) => !Number.isNaN(num));
  const nextNumber = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1049;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');

  const newIncident = {
    id: `#${nextNumber}`,
    typeId: matchedType.id,
    typeLabel: matchedType.label,
    icon: matchedType.icon,
    address: payload.address?.trim() || INITIAL_USER.address,
    time: `${hours}:${mins}`,
    status: 'new',
    statusLabel: 'Новое',
    service: '—',
    description: payload.description?.trim() || '',
    anonymous: Boolean(payload.anonymous),
    photosCount: payload.photosCount || 0,
  };

  const updatedIncidents = [newIncident, ...currentIncidents];
  saveStoredIncidents(updatedIncidents);
  return { incident: newIncident, incidents: updatedIncidents };
}

/**
 * Фото к уже созданной метке — по одному файлу, чтобы битый файл не отменял остальные.
 * Возвращает {failed: [{file, message}]}.
 */
export async function uploadIncidentPhotos(incidentId, files) {
  const failed = [];
  for (const file of files.filter(Boolean).slice(0, 4)) {
    const form = new FormData();
    form.append('files', file);
    try {
      await request(`/incidents/${incidentId}/photos`, {
        method: 'POST',
        form,
        fallback: 'Фото загрузить не удалось',
      });
    } catch (error) {
      if (error.status === 401) throw error;
      failed.push({ file, message: error.message });
    }
  }
  return { failed };
}

/**
 * Панель модератора: смена статуса и заметки (note — строка; пустая стирает заметку,
 * undefined — не менять). Возвращает весь список меток панели.
 */
export async function updateIncidentStatus(incidentId, nextStatus, assignedService) {
  if (!USE_MOCK) {
    const id = String(incidentId).replace(/\D/g, ''); // «#1048» → 1048
    const body = { status: nextStatus };
    if (assignedService !== undefined) body.moderatorNote = assignedService;
    await request(`/moderation/incidents/${id}`, {
      method: 'PATCH',
      body,
      fallback: 'Не удалось обновить статус обращения',
    });
    return fetchOperatorIncidents();
  }

  const STATUS_LABELS = {
    new: 'Новое',
    in_progress: 'В работе',
    closed: 'Закрыто',
  };

  const currentIncidents = getStoredIncidents();
  const updatedIncidents = currentIncidents.map((inc) => {
    if (inc.id !== incidentId) return inc;
    const matchedType = INCIDENT_TYPES.find((t) => t.id === inc.typeId);
    const resolvedService =
      assignedService ||
      (inc.service && inc.service !== '—'
        ? inc.service
        : matchedType?.defaultService || 'ЕДДС 112');
    return {
      ...inc,
      status: nextStatus,
      statusLabel: STATUS_LABELS[nextStatus] || inc.statusLabel,
      service: nextStatus === 'new' ? '—' : resolvedService,
    };
  });

  saveStoredIncidents(updatedIncidents);
  return updatedIncidents;
}

// ---------- оповещения ----------

/** Модератор правит оповещение или снимает его с публикации (patch.isPublished = false). */
export async function updateCityAlert(alertId, patch) {
  if (USE_MOCK) {
    const alerts = getStoredAlerts().map((a) => (a.id === alertId ? { ...a, ...patch } : a));
    saveStoredAlerts(alerts);
    return alerts;
  }
  const body = { ...patch };
  for (const field of ['subtitle', 'locationLabel', 'sourceLabel']) {
    if (typeof body[field] === 'string') body[field] = body[field].trim() || null;
  }
  return adaptAlert(
    await request(`/alerts/${alertId}`, {
      method: 'PATCH',
      body,
      fallback: 'Не удалось изменить оповещение',
    })
  );
}

/** Модератор публикует оповещение. Возвращает всю ленту. */
export async function createCityAlert(payload) {
  if (!USE_MOCK) {
    const checklist = Array.isArray(payload.actionsChecklist) ? payload.actionsChecklist : [];
    await request('/alerts', {
      method: 'POST',
      body: {
        title: payload.title,
        subtitle: payload.subtitle?.trim() || null,
        description: payload.description,
        level: payload.level || 'warning',
        locationLabel: payload.locationLabel?.trim() || null,
        sourceLabel: payload.sourceLabel?.trim() || null,
        actionsChecklist: checklist,
      },
      fallback: 'Не удалось создать оповещение',
    });
    const alerts = await request('/alerts');
    return alerts.map((a) => adaptAlert(a));
  }

  const level = payload.level || 'warning';
  const cfg = ALERT_LEVEL_CONFIG[level] || ALERT_LEVEL_CONFIG.warning;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
    2,
    '0'
  )}`;

  const newAlert = {
    id: `alt_${Date.now()}`,
    title: payload.title.trim(),
    subtitle: payload.subtitle?.trim() || payload.description.trim().slice(0, 60),
    description: payload.description.trim(),
    level,
    badgeText: cfg.badgeText,
    timeAgo: 'только что',
    detailedTime: `Сегодня, ${timeStr} · только что`,
    locationLabel: payload.locationLabel?.trim() || 'Весь город',
    sourceLabel: payload.sourceLabel?.trim() || 'Безопасный город',
    icon: cfg.icon,
    bgColor: cfg.bgColor,
    accentColor: cfg.accentColor,
    borderColor: cfg.borderColor,
    showOnHomeDesktop: true,
    showOnMobileFeed: true,
    actionsChecklist:
      Array.isArray(payload.actionsChecklist) && payload.actionsChecklist.length > 0
        ? payload.actionsChecklist
        : [
            'Следите за официальными сообщениями оперативных служб',
            'Соблюдайте меры предосторожности в указанном районе',
            'При экстренной ситуации звоните по номеру 112',
          ],
  };

  const currentAlerts = getStoredAlerts();
  const updatedAlerts = [newAlert, ...currentAlerts];
  saveStoredAlerts(updatedAlerts);
  return updatedAlerts;
}
