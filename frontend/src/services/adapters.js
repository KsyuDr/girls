/**
 * Адаптеры: ответы FastAPI-бэкенда → форма данных, которую ждут компоненты страниц
 * (та же, что в src/mock/data.js). Сервер отдаёт «сырые» данные (ISO-время, метры,
 * level/type/category), а подписи, цвета и иконки собираются здесь.
 */

const AVATAR_PALETTE = ['#007DA5', '#003C54', '#008F82', '#00C9B7'];

export const ALERT_LEVEL_CONFIG = {
  critical: {
    badgeText: 'Критическое',
    icon: 'triangle-alert',
    bgColor: '#FDE7EC',
    accentColor: '#ED0536',
    borderColor: '#ED0536',
  },
  warning: {
    badgeText: 'Предупреждение',
    icon: 'bell',
    bgColor: '#E5F2F7',
    accentColor: '#007DA5',
    borderColor: '#007DA5',
  },
  info: {
    badgeText: 'Информация',
    icon: 'message-circle',
    bgColor: '#E0F7F4',
    accentColor: '#008F82',
    borderColor: '#00C9B7',
  },
};

const PLACE_STYLES = {
  shelter: { label: 'Пункт помощи', icon: 'home', iconBg: '#E0F7F4', iconColor: '#008F82' },
  hospital: { label: 'Больница', icon: 'plus', iconBg: '#E0F7F4', iconColor: '#008F82' },
  police: { label: 'Полиция', icon: 'shield', iconBg: '#E5F2F7', iconColor: '#007DA5' },
  danger: {
    label: 'Опасное место',
    icon: 'triangle-alert',
    iconBg: '#FDE7EC',
    iconColor: '#ED0536',
  },
};
const PIN_COLORS = {
  shelter: '#008F82',
  hospital: '#008F82',
  police: '#007DA5',
  danger: '#ED0536',
};

export const INCIDENT_STATUS_LABELS = {
  new: 'Новое',
  in_progress: 'В работе',
  closed: 'Закрыто',
  hidden: 'Скрыто',
};

const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

// ---------- мелкие форматтеры ----------

export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'К'
  );
}

/** +79122041833 → +7 912 204-18-33 */
export function formatPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length !== 11) return phone || '';
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatTime(iso) {
  const date = new Date(iso);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function timeAgo(iso, now = new Date()) {
  const date = new Date(iso);
  const minutes = Math.max(0, Math.round((now - date) / 60000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24 && isSameDay(date, now)) return `${hours} ч назад`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'вчера';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function detailedTime(iso, now = new Date()) {
  const date = new Date(iso);
  const time = formatTime(iso);
  if (isSameDay(date, now)) return `Сегодня, ${time} · ${timeAgo(iso, now)}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Вчера, ${time}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

/** Время в таблице: сегодня — «14:05», вчера — «вчера, 14:05», раньше — «8 нояб., 14:05». */
export function shortDateTime(iso, now = new Date()) {
  const date = new Date(iso);
  const time = formatTime(iso);
  if (isSameDay(date, now)) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `вчера, ${time}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

/** Сколько прошло: «только что», «25 мин», «3 ч 5 мин», «2 дн». */
export function elapsedLabel(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч ${minutes % 60} мин назад`;
  return `${Math.floor(hours / 24)} дн ${hours % 24} ч назад`;
}

export function formatDistance(meters) {
  if (meters === null || meters === undefined) return '';
  if (meters < 1000) return `${Math.round(meters / 10) * 10 || meters} м`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
}

function walkTime(meters) {
  if (meters === null || meters === undefined) return '';
  const minutes = Math.max(1, Math.round(meters / 80)); // ~4,8 км/ч
  return `${minutes} мин пешком`;
}

function todayLabel(now = new Date()) {
  return `Сегодня, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

// ---------- сущности ----------

export const GUEST_USER = {
  id: null,
  name: 'Гость',
  mobileName: 'Гость',
  firstName: 'Гость',
  initials: 'Г',
  phone: '',
  displayPhone: 'Войдите, чтобы отправлять SOS',
  city: 'Москва',
  address: '',
  coordinates: '',
  accuracyMeters: '—',
  geolocationEnabled: false,
  pushNotificationsEnabled: false,
  hasLocation: false,
  role: 'guest',
  isModerator: false,
};

export function adaptUser(user, activeSos = null) {
  if (!user) return GUEST_USER;
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const hasPoint = user.lastLat !== null && user.lastLng !== null;
  return {
    id: user.id,
    name: user.name,
    mobileName: user.name,
    firstName,
    initials: initialsOf(user.name),
    phone: formatPhone(user.phone),
    displayPhone: formatPhone(user.phone),
    rawPhone: user.phone,
    city: user.city,
    address:
      user.lastAddress || (hasPoint ? 'Текущее местоположение' : 'Местоположение неизвестно'),
    coordinates: hasPoint ? `${user.lastLat.toFixed(4)}, ${user.lastLng.toFixed(4)}` : '—',
    lat: user.lastLat,
    lng: user.lastLng,
    hasLocation: hasPoint,
    accuracyMeters: activeSos?.accuracyMeters ?? '—',
    geolocationEnabled: user.geolocationEnabled,
    pushNotificationsEnabled: user.pushNotificationsEnabled,
    role: user.role,
    isModerator: user.role === 'moderator',
  };
}

export function adaptGuide(guide) {
  const n = guide.steps.length;
  const steps = `${n} ${plural(n, 'шаг', 'шага', 'шагов')}`;
  const minutes = `${guide.readMinutes} ${plural(guide.readMinutes, 'минута', 'минуты', 'минут')}`;
  return {
    ...guide,
    stepsCountLabel: steps,
    metaSubtitle: `${guide.source} · ${steps} · ${minutes} чтения`,
  };
}

export function adaptAlert(alert, now = new Date()) {
  const cfg = ALERT_LEVEL_CONFIG[alert.level] || ALERT_LEVEL_CONFIG.warning;
  return {
    ...alert,
    ...cfg,
    subtitle: alert.subtitle || alert.description.slice(0, 60),
    sourceLabel: alert.sourceLabel || 'Безопасный город',
    // Как пришло с сервера — для формы правки у модератора
    rawSubtitle: alert.subtitle || '',
    rawSourceLabel: alert.sourceLabel || '',
    timeAgo: timeAgo(alert.createdAt, now),
    detailedTime: detailedTime(alert.createdAt, now),
    showOnHomeDesktop: true,
    showOnMobileFeed: true,
  };
}

export function adaptContact(contact, index, activeSos = null) {
  const delivery = activeSos?.notifiedContacts?.find((d) => d.contactId === contact.id);
  return {
    ...contact,
    initials: initialsOf(contact.name),
    mobileShortLabel: contact.relation || contact.name.split(/\s+/)[0],
    phone: formatPhone(contact.phone),
    avatarBg: AVATAR_PALETTE[index % AVATAR_PALETTE.length],
    notifyMethod: 'SMS',
    sosDeliveryStatus: delivery?.status || 'delivered',
    showOnMobileSos: true,
  };
}

export function adaptIncidentType(type) {
  return { id: type.id, label: type.label, icon: type.icon, defaultService: type.hint };
}

export function adaptReportSteps(steps) {
  return steps.map((step, index) => ({ ...step, number: String(index + 1) }));
}

// Центры городов из справочника: с них карта начинается, если места пользователя нет
export const CITY_CENTERS = {
  Москва: { lat: 55.7558, lng: 37.6173 },
  'Санкт-Петербург': { lat: 59.9386, lng: 30.3141 },
  Екатеринбург: { lat: 56.8389, lng: 60.6057 },
  Казань: { lat: 55.7963, lng: 49.1088 },
  Новосибирск: { lat: 55.0302, lng: 82.9204 },
  'Нижний Новгород': { lat: 56.3269, lng: 44.0059 },
};

/** Точки дальше этого расстояния от центра карты не рисуем: одна «далёкая» метка ломала масштаб. */
export const MAP_RADIUS_METERS = 30000;

function isPoint(p) {
  return p && typeof p.lat === 'number' && typeof p.lng === 'number';
}

/** Расстояние по прямой в метрах (гаверсинус). */
export function distanceMeters(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Центр карты: место пользователя, иначе среднее справочных точек, иначе центр Москвы. */
export function pickMapCenter(userPoint, places) {
  if (isPoint(userPoint)) return userPoint;
  const valid = places.filter(isPoint);
  if (valid.length === 0) return { lat: 55.7539, lng: 37.6208 };
  return {
    lat: valid.reduce((s, p) => s + p.lat, 0) / valid.length,
    lng: valid.reduce((s, p) => s + p.lng, 0) / valid.length,
  };
}

/** Оставляет точки не дальше MAP_RADIUS_METERS от центра (точки без координат отбрасываются). */
export function nearCenter(points, center) {
  return points.filter((p) => isPoint(p) && distanceMeters(center, p) <= MAP_RADIUS_METERS);
}

/**
 * Карта в макете — картинка, а не настоящая карта. Проецируем координаты в проценты
 * вокруг маркера «Вы здесь» (left 46%, top 57%), масштаб — по самой дальней точке.
 */
export function makeProjection(points, center) {
  const valid = points.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
  const origin =
    center && typeof center.lat === 'number' && typeof center.lng === 'number'
      ? center
      : valid.length > 0
        ? {
            lat: valid.reduce((s, p) => s + p.lat, 0) / valid.length,
            lng: valid.reduce((s, p) => s + p.lng, 0) / valid.length,
          }
        : { lat: 55.7539, lng: 37.6208 };
  const kx = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  const ky = 111320;
  const maxOffset = Math.max(
    300,
    ...valid.map((p) =>
      Math.max(Math.abs((p.lng - origin.lng) * kx), Math.abs((p.lat - origin.lat) * ky))
    )
  );
  const clamp = (v) => Math.min(95, Math.max(5, v));
  return (lat, lng) => {
    const left = clamp(46 + (((lng - origin.lng) * kx) / maxOffset) * 40);
    const top = clamp(57 - (((lat - origin.lat) * ky) / maxOffset) * 40);
    const pos = { left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%` };
    return { desktopPos: pos, mobilePos: pos };
  };
}

function placeBadge(category, isOpen, hoursLabel) {
  if (category === 'danger')
    return { badgeText: 'Опасно', badgeBg: '#FDE7EC', badgeColor: '#ED0536' };
  if (!isOpen) return { badgeText: 'Закрыто', badgeBg: '#EDF1F5', badgeColor: '#6B7A89' };
  const text = hoursLabel === 'Круглосуточно' ? 'Круглосуточно' : 'Открыто';
  return { badgeText: text, badgeBg: '#E0F7F4', badgeColor: '#008F82' };
}

export function adaptPlace(place, project) {
  const style = PLACE_STYLES[place.category] || PLACE_STYLES.shelter;
  const distance = formatDistance(place.distanceMeters);
  return {
    id: `plc_${place.id}`,
    title: place.title,
    subtitle: distance ? `${style.label} · ${distance}` : style.label,
    shortMeta: distance ? `${place.address} · ${distance}` : place.address,
    address: place.address,
    distanceLabel: distance || 'расстояние неизвестно',
    walkTimeLabel: walkTime(place.distanceMeters) || 'включите геолокацию',
    hoursLabel: place.hoursLabel || '',
    category: place.category,
    icon: style.icon,
    iconBg: style.iconBg,
    iconColor: style.iconColor,
    pinColor: PIN_COLORS[place.category] || '#007DA5',
    phone: place.phone || '112',
    hasDangerZone: place.category === 'danger',
    lat: place.lat,
    lng: place.lng,
    ...placeBadge(place.category, place.isOpen, place.hoursLabel),
    ...project(place.lat, place.lng),
  };
}

/** Метки жителей типа «опасность» тоже показываем на карте в категории «Опасные места». */
export function adaptIncidentAsPlace(incident, typesById, project) {
  const type = typesById[incident.type];
  const distance = formatDistance(incident.distanceMeters);
  return {
    id: `inc_${incident.id}`,
    title: type?.label || 'Происшествие',
    subtitle: distance ? `Метка жителя · ${distance}` : 'Метка жителя',
    shortMeta: distance ? `${incident.address} · ${distance}` : incident.address,
    address: incident.address,
    distanceLabel: distance || 'расстояние неизвестно',
    walkTimeLabel: walkTime(incident.distanceMeters) || 'включите геолокацию',
    hoursLabel: `${INCIDENT_STATUS_LABELS[incident.status] || ''} · ${timeAgo(incident.createdAt)}`,
    category: 'danger',
    icon: type?.icon === 'flame' ? 'flame' : 'triangle-alert',
    iconBg: PLACE_STYLES.danger.iconBg,
    iconColor: PLACE_STYLES.danger.iconColor,
    pinColor: PIN_COLORS.danger,
    phone: '112',
    hasDangerZone: false,
    badgeText: 'Опасно',
    badgeBg: '#FDE7EC',
    badgeColor: '#ED0536',
    lat: incident.lat,
    lng: incident.lng,
    ...project(incident.lat, incident.lng),
  };
}

export function adaptOperatorIncident(incident, typesById, now = new Date()) {
  const type = typesById[incident.type];
  return {
    id: `#${incident.id}`,
    rawId: incident.id,
    typeId: incident.type,
    typeLabel: type?.label || incident.type,
    icon: type?.icon || 'more-horizontal',
    address: incident.address,
    time: shortDateTime(incident.createdAt, now),
    createdAt: incident.createdAt,
    status: incident.status,
    statusLabel: INCIDENT_STATUS_LABELS[incident.status] || incident.status,
    service: incident.moderatorNote || '—',
    moderatorNote: incident.moderatorNote || '',
    description: incident.description,
    anonymous: incident.isAnonymous,
    photosCount: incident.photos.length,
    author: incident.author,
  };
}

export function adaptOperatorProfile(user, now = new Date()) {
  return {
    initials: initialsOf(user?.name),
    name: user?.name || 'Модератор',
    role: 'Модератор',
    dateSubtitle: `${todayLabel(now)} · обновляется автоматически`,
  };
}

export function adaptSos(sos) {
  const hasPoint = sos.lat !== null && sos.lng !== null;
  return {
    id: sos.id,
    status: sos.status,
    startedAt: Date.parse(sos.startedAt),
    // Есть ли у сигнала хоть какое-то место: иначе близкие получили сообщение без координат
    hasLocation: hasPoint || Boolean(sos.address),
    notifiedContacts: sos.notifiedContacts.map((d, i) => ({
      id: d.contactId ?? `dlv_${d.id}`,
      initials: initialsOf(d.name),
      name: d.name,
      relation: d.relation,
      mobileShortLabel: d.relation,
      phone: formatPhone(d.phone),
      avatarBg: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
      receivesSos: true,
      notifyMethod: 'SMS',
      sosDeliveryStatus: d.status,
    })),
    // Координаты есть, а адреса нет — не пишем «неизвестно» рядом с точкой
    address: sos.address || (hasPoint ? 'Адрес не указан' : 'Местоположение неизвестно'),
    coordinates: hasPoint ? `${sos.lat.toFixed(4)}, ${sos.lng.toFixed(4)}` : '—',
    accuracyMeters: sos.accuracyMeters ?? '—',
  };
}

/** SOS другого жителя в панели модератора: имя, телефон, где и как давно. */
export function adaptModerationSos(sos) {
  const hasPoint = sos.lat !== null && sos.lng !== null;
  return {
    id: sos.id,
    userName: sos.user.name,
    phone: sos.user.phone,
    displayPhone: formatPhone(sos.user.phone),
    address: sos.address || (hasPoint ? 'Адрес не указан' : 'Местоположение неизвестно'),
    coordinates: hasPoint ? `${sos.lat.toFixed(4)}, ${sos.lng.toFixed(4)}` : '—',
    lat: sos.lat,
    lng: sos.lng,
    accuracyMeters: sos.accuracyMeters,
    startedAt: Date.parse(sos.startedAt),
    notifiedCount: sos.notifiedContacts.length,
  };
}

/** Весь ответ GET /api/dashboard → объект, который App.jsx кладёт в state. */
export function adaptDashboard(data) {
  const ref = data.reference;
  const typesById = Object.fromEntries(ref.incidentTypes.map((t) => [t.id, t]));
  const userPoint = data.user ? { lat: data.user.lastLat, lng: data.user.lastLng } : null;
  const center = pickMapCenter(userPoint, data.places);
  // Выбросы (например, метка с координатами 0, 0) на карту не попадают и масштаб не портят
  const places = nearCenter(data.places, center);
  const dangerIncidents = nearCenter(
    data.incidents.filter((i) => typesById[i.type]?.group === 'danger' && i.status !== 'closed'),
    center
  );
  const project = makeProjection([...places, ...dangerIncidents], center);
  const activeSos = data.activeSos;

  const result = {
    isAuthenticated: data.isAuthenticated,
    user: adaptUser(data.user, activeSos),
    services: ref.services,
    alerts: data.alerts.map((a) => adaptAlert(a)),
    guides: ref.guides.map(adaptGuide),
    contacts: data.contacts.map((c, i) => adaptContact(c, i, activeSos)),
    maxContacts: ref.maxContacts,
    sosWaitingTips: ref.sosWaitingTips,
    mapCategories: ref.mapCategories,
    mapPlaces: [
      ...dangerIncidents.map((i) => adaptIncidentAsPlace(i, typesById, project)),
      ...places.map((p) => adaptPlace(p, project)),
    ],
    incidentTypes: ref.incidentTypes.filter((t) => t.group === 'danger').map(adaptIncidentType),
    reportNextSteps: adaptReportSteps(ref.reportNextSteps),
    cities: ref.cities,
    activeSos: activeSos ? adaptSos(activeSos) : null,
    operatorIncidents: data.moderation
      ? data.moderation.incidents.map((i) => adaptOperatorIncident(i, typesById))
      : [],
    operatorSos: data.moderation ? data.moderation.activeSos.map(adaptModerationSos) : [],
    operatorStats: data.moderation ? data.moderation.stats : null,
    // Все оповещения, включая снятые: модератор может исправить или вернуть их
    operatorAlerts: data.moderation ? (data.moderation.alerts || []).map((a) => adaptAlert(a)) : [],
    operatorProfile: adaptOperatorProfile(data.user),
    incidentTypesById: typesById,
  };
  return result;
}
