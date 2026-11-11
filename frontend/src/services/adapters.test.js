import { describe, expect, it } from 'vitest';
import {
  adaptContact,
  adaptDashboard,
  adaptModerationSos,
  adaptSos,
  adaptUser,
  distanceMeters,
  elapsedLabel,
  formatDistance,
  formatPhone,
  makeProjection,
  nearCenter,
  pickMapCenter,
  plural,
  shortDateTime,
  timeAgo,
} from './adapters';

const MOSCOW = { lat: 55.7539, lng: 37.6208 };

const user = (overrides = {}) => ({
  id: 1,
  name: 'Полина Исупова',
  phone: '+79120000001',
  city: 'Москва',
  role: 'user',
  geolocationEnabled: true,
  pushNotificationsEnabled: true,
  lastLat: MOSCOW.lat,
  lastLng: MOSCOW.lng,
  lastAddress: 'Красная площадь',
  ...overrides,
});

const place = (id, lat, lng, category = 'shelter') => ({
  id,
  title: `Точка ${id}`,
  category,
  address: 'ул. Тестовая, 1',
  lat,
  lng,
  hoursLabel: 'Круглосуточно',
  phone: '112',
  isOpen: true,
  distanceMeters: 500,
});

const incident = (id, lat, lng, status = 'new') => ({
  id,
  type: 'fire',
  description: 'Задымление',
  address: 'ул. Никольская, 10',
  lat,
  lng,
  status,
  isAnonymous: false,
  photos: [],
  author: { id: 2, name: 'Иван П.' },
  createdAt: new Date().toISOString(),
  distanceMeters: 300,
});

const dashboard = (overrides = {}) => ({
  isAuthenticated: true,
  user: user(),
  reference: {
    services: [],
    guides: [],
    incidentTypes: [
      { id: 'fire', label: 'Пожар', icon: 'flame', group: 'danger', hint: 'Пожарная' },
    ],
    mapCategories: [],
    cities: ['Москва'],
    sosWaitingTips: [],
    reportNextSteps: [],
    maxContacts: 5,
  },
  alerts: [],
  places: [place(1, 55.7545, 37.6215)],
  incidents: [],
  contacts: [],
  activeSos: null,
  moderation: null,
  ...overrides,
});

describe('форматтеры', () => {
  it('plural склоняет по-русски', () => {
    const word = (n) => plural(n, 'шаг', 'шага', 'шагов');
    expect([1, 2, 5, 11, 21, 112].map(word)).toEqual([
      'шаг',
      'шага',
      'шагов',
      'шагов',
      'шаг',
      'шагов',
    ]);
  });

  it('formatPhone приводит номер к виду +7 912 000-00-01', () => {
    expect(formatPhone('+79120000001')).toBe('+7 912 000-00-01');
    expect(formatPhone('123')).toBe('123');
  });

  it('formatDistance: метры и километры', () => {
    expect(formatDistance(420)).toBe('420 м');
    expect(formatDistance(1500)).toBe('1,5 км');
    expect(formatDistance(null)).toBe('');
  });

  it('timeAgo', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    expect(timeAgo('2026-11-10T11:55:00Z', now)).toBe('5 мин назад');
    expect(timeAgo('2026-11-10T12:00:00Z', now)).toBe('только что');
  });
});

describe('время в панели модератора', () => {
  it('elapsedLabel переводит минуты в часы и дни', () => {
    expect(elapsedLabel(30 * 1000)).toBe('только что');
    expect(elapsedLabel(25 * 60000)).toBe('25 мин назад');
    expect(elapsedLabel(185 * 60000)).toBe('3 ч 5 мин назад');
    expect(elapsedLabel(1405 * 60000)).toBe('23 ч 25 мин назад');
    expect(elapsedLabel(3000 * 60000)).toBe('2 дн 2 ч назад');
  });

  it('shortDateTime: у старых меток есть дата', () => {
    const now = new Date(2026, 10, 10, 15, 0);

    expect(shortDateTime(new Date(2026, 10, 10, 14, 5).toISOString(), now)).toBe('14:05');
    expect(shortDateTime(new Date(2026, 10, 9, 9, 30).toISOString(), now)).toBe('вчера, 09:30');
    expect(shortDateTime(new Date(2026, 10, 2, 8, 0).toISOString(), now)).toBe('2 ноября, 08:00');
  });
});

describe('пользователь и SOS', () => {
  it('adaptUser: hasLocation и адрес, когда места нет', () => {
    const known = adaptUser(user());
    const unknown = adaptUser(user({ lastLat: null, lastLng: null, lastAddress: null }));

    expect(known.hasLocation).toBe(true);
    expect(unknown.hasLocation).toBe(false);
    expect(unknown.address).toBe('Местоположение неизвестно');
  });

  it('adaptUser: модератор определяется по роли', () => {
    expect(adaptUser(user({ role: 'moderator' })).isModerator).toBe(true);
    expect(adaptUser(user()).isModerator).toBe(false);
  });

  it('adaptSos оставляет только тех, кому сигнал реально ушёл', () => {
    const sos = adaptSos({
      id: 7,
      status: 'active',
      lat: null,
      lng: null,
      address: null,
      accuracyMeters: null,
      startedAt: '2026-11-10T12:00:00Z',
      notifiedContacts: [],
    });

    expect(sos.notifiedContacts).toEqual([]);
    expect(sos.coordinates).toBe('—');
    expect(sos.hasLocation).toBe(false);
    expect(sos.address).toBe('Местоположение неизвестно');
  });

  it('adaptSos: точка есть, адреса нет — не «местоположение неизвестно»', () => {
    const sos = adaptSos({
      id: 8,
      status: 'active',
      lat: 55.7616,
      lng: 37.6094,
      address: null,
      accuracyMeters: 12,
      startedAt: '2026-11-10T12:00:00Z',
      notifiedContacts: [],
    });

    expect(sos.address).toBe('Адрес не указан');
    expect(sos.coordinates).toBe('55.7616, 37.6094');
    expect(sos.hasLocation).toBe(true);
  });

  it('adaptModerationSos: имя, телефон и число получивших', () => {
    const sos = adaptModerationSos({
      id: 3,
      user: { id: 9, name: 'Ольга Соседова', phone: '+79005551102' },
      lat: 55.76,
      lng: 37.62,
      address: 'Лубянка, 1',
      accuracyMeters: 12,
      startedAt: '2026-11-10T12:00:00Z',
      notifiedContacts: [{ id: 1 }, { id: 2 }],
    });

    expect(sos).toMatchObject({
      id: 3,
      userName: 'Ольга Соседова',
      displayPhone: '+7 900 555-11-02',
      address: 'Лубянка, 1',
      notifiedCount: 2,
    });
  });

  it('adaptContact: статус доставки берётся из активного SOS', () => {
    const contact = {
      id: 5,
      name: 'Мама Мамина',
      relation: 'Мама',
      phone: '+79220000001',
      notifyMethod: 'sms',
    };
    const active = { notifiedContacts: [{ contactId: 5, status: 'failed' }] };

    expect(adaptContact(contact, 0, active).sosDeliveryStatus).toBe('failed');
  });
});

describe('карта', () => {
  it('distanceMeters считает расстояние по гаверсинусу', () => {
    const d = distanceMeters(MOSCOW, { lat: 55.8, lng: 37.6208 });
    expect(d).toBeGreaterThan(5000);
    expect(d).toBeLessThan(5300);
  });

  it('pickMapCenter: место пользователя, иначе среднее точек, иначе Москва', () => {
    expect(pickMapCenter({ lat: 1, lng: 2 }, [])).toEqual({ lat: 1, lng: 2 });
    expect(
      pickMapCenter({ lat: null, lng: null }, [
        { lat: 10, lng: 20 },
        { lat: 20, lng: 40 },
      ])
    ).toEqual({
      lat: 15,
      lng: 30,
    });
    expect(pickMapCenter(null, [])).toEqual(MOSCOW);
  });

  it('nearCenter отбрасывает выбросы и точки без координат', () => {
    const points = [
      { lat: 55.76, lng: 37.62 },
      { lat: 0, lng: 0 },
      { lat: null, lng: null },
    ];

    expect(nearCenter(points, MOSCOW)).toEqual([points[0]]);
  });

  it('makeProjection кладёт центр в точку «Вы здесь»', () => {
    const project = makeProjection([], MOSCOW);

    expect(project(MOSCOW.lat, MOSCOW.lng).desktopPos).toEqual({ left: '46.0%', top: '57.0%' });
  });

  it('метка с координатами 0, 0 не ломает карту всем остальным', () => {
    const clean = adaptDashboard(dashboard({ incidents: [incident(1, 55.757, 37.623)] }));
    const withOutlier = adaptDashboard(
      dashboard({ incidents: [incident(1, 55.757, 37.623), incident(2, 0, 0)] })
    );

    const positions = (result) =>
      Object.fromEntries(result.mapPlaces.map((p) => [p.id, p.desktopPos]));
    expect(withOutlier.mapPlaces.map((p) => p.id)).not.toContain('inc_2');
    expect(positions(withOutlier)).toEqual(positions(clean));
    // точки не слиплись в одну позицию
    const distinct = new Set(withOutlier.mapPlaces.map((p) => JSON.stringify(p.desktopPos)));
    expect(distinct.size).toBe(withOutlier.mapPlaces.length);
  });
});

describe('adaptDashboard', () => {
  it('у жителя нет данных модератора', () => {
    const result = adaptDashboard(dashboard());

    expect(result.operatorSos).toEqual([]);
    expect(result.operatorStats).toBeNull();
    expect(result.user.isModerator).toBe(false);
  });

  it('у модератора есть реальные SOS и счётчики', () => {
    const result = adaptDashboard(
      dashboard({
        user: user({ role: 'moderator' }),
        moderation: {
          incidents: [incident(1, 55.757, 37.623, 'hidden')],
          activeSos: [
            {
              id: 3,
              user: { id: 9, name: 'Ольга Соседова', phone: '+79005551102' },
              lat: 55.76,
              lng: 37.62,
              address: 'Лубянка, 1',
              accuracyMeters: 12,
              startedAt: '2026-11-10T12:00:00Z',
              notifiedContacts: [],
            },
          ],
          stats: { newIncidents: 0, inProgress: 0, hidden: 1, activeSos: 1 },
        },
      })
    );

    expect(result.operatorSos).toHaveLength(1);
    expect(result.operatorSos[0].userName).toBe('Ольга Соседова');
    expect(result.operatorStats.activeSos).toBe(1);
    expect(result.operatorIncidents[0].status).toBe('hidden');
    expect(result.operatorIncidents[0].statusLabel).toBe('Скрыто');
    expect(result.operatorAlerts).toEqual([]);
  });

  it('модератор получает и снятые с публикации оповещения', () => {
    const alert = {
      id: 5,
      title: 'Ошибочное',
      subtitle: null,
      description: 'Опубликовано по ошибке',
      level: 'critical',
      locationLabel: 'Весь город',
      sourceLabel: null,
      actionsChecklist: [],
      isPublished: false,
      createdAt: '2026-11-10T12:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z',
    };
    const result = adaptDashboard(
      dashboard({
        user: user({ role: 'moderator' }),
        moderation: { incidents: [], activeSos: [], stats: {}, alerts: [alert] },
      })
    );

    expect(result.alerts).toEqual([]);
    expect(result.operatorAlerts[0]).toMatchObject({ id: 5, isPublished: false, rawSubtitle: '' });
  });

  it('гость: пустые контакты, не модератор', () => {
    const result = adaptDashboard(dashboard({ isAuthenticated: false, user: null }));

    expect(result.isAuthenticated).toBe(false);
    expect(result.contacts).toEqual([]);
    expect(result.user.isModerator).toBe(false);
  });
});
