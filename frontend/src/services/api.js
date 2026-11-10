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

/**
 * Единый сервисный слой для работы с бэкендом.
 * Пока сервер (Node.js + PostgreSQL) в разработке, USE_MOCK = true.
 * Когда бэкенд будет готов, достаточно переключить VITE_USE_MOCK=false
 * и задать VITE_API_URL в .env — компоненты менять не придётся.
 */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const STORAGE_USER_KEY = 'safe_city_user';
const STORAGE_CONTACTS_KEY = 'safe_city_contacts';
const STORAGE_INCIDENTS_KEY = 'safe_city_incidents';
const STORAGE_ALERTS_KEY = 'safe_city_alerts';

const AVATAR_PALETTE = ['#007DA5', '#003C54', '#008F82', '#00C9B7'];

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

export async function registerUser(payload) {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Ошибка при регистрации пользователя');
    }
    return response.json();
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

export async function getDashboardData() {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/dashboard`);
    if (!response.ok) {
      throw new Error('Не удалось загрузить данные');
    }
    return response.json();
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

export async function sendSosSignal(coordinates) {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coordinates),
    });
    if (!response.ok) {
      throw new Error('Не удалось отправить сигнал SOS');
    }
    return response.json();
  }

  await new Promise((resolve) => setTimeout(resolve, 200));
  const contacts = getStoredContacts().filter((c) => c.receivesSos);
  return {
    id: `sos_${Date.now()}`,
    status: 'active',
    startedAt: Date.now() - 42 * 1000, // Стартуем с 00:42 как в макете, далее идёт живой секундомер
    notifiedContacts: contacts,
    address: coordinates?.address || INITIAL_USER.address,
    coordinates: coordinates?.coordinates || INITIAL_USER.coordinates,
    accuracyMeters: coordinates?.accuracyMeters || INITIAL_USER.accuracyMeters,
  };
}

export async function cancelSosSignal(sosId) {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/sos/${sosId || 'active'}/cancel`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Не удалось отменить сигнал SOS');
    }
    return response.json();
  }

  await new Promise((resolve) => setTimeout(resolve, 150));
  return { status: 'cancelled' };
}

export async function toggleContactSos(contactId, receivesSos) {
  const currentContacts = getStoredContacts();
  const target = currentContacts.find((c) => c.id === contactId);
  const nextReceivesSos =
    typeof receivesSos === 'boolean' ? receivesSos : !(target?.receivesSos ?? false);

  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivesSos: nextReceivesSos }),
    });
    if (!response.ok) {
      throw new Error('Не удалось обновить статус контакта');
    }
    return response.json();
  }

  const contacts = currentContacts.map((c) =>
    c.id === contactId ? { ...c, receivesSos: nextReceivesSos } : c
  );
  saveStoredContacts(contacts);
  return contacts;
}

export async function addEmergencyContact(payload) {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Не удалось добавить контакт');
    }
    return response.json();
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
    const response = await fetch(`${API_BASE_URL}/contacts/${contactId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Не удалось удалить контакт');
    }
    return response.json();
  }

  const updated = getStoredContacts().filter((c) => c.id !== contactId);
  saveStoredContacts(updated);
  return updated;
}

export async function togglePushNotifications(enabled) {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/user/notifications`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pushNotificationsEnabled: enabled }),
    });
    if (!response.ok) {
      throw new Error('Не удалось обновить настройки уведомлений');
    }
    return response.json();
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

export async function submitIncidentReport(payload) {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Не удалось отправить обращение');
    }
    return response.json();
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

export async function updateIncidentStatus(incidentId, nextStatus, assignedService) {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, service: assignedService }),
    });
    if (!response.ok) {
      throw new Error('Не удалось обновить статус обращения');
    }
    return response.json();
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

export async function createCityAlert(payload) {
  if (!USE_MOCK) {
    const response = await fetch(`${API_BASE_URL}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Не удалось создать оповещение');
    }
    return response.json();
  }

  const LEVEL_CONFIG = {
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

  const level = payload.level || 'warning';
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.warning;
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
    sourceLabel: payload.sourceLabel?.trim() || 'ЕДДС города',
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
