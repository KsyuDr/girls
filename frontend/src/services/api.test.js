import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ответ сервера в форме, которую читает request()
const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let calls;
let responses;
let storage;

/** Свежий api.js с VITE_USE_MOCK=false и подменённым fetch (по очереди отдаёт `responses`). */
async function loadApi() {
  vi.resetModules();
  vi.stubEnv('VITE_USE_MOCK', 'false');
  vi.stubEnv('VITE_API_URL', 'http://api.test/api');
  return import('./api.js');
}

beforeEach(() => {
  calls = [];
  responses = [];
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      calls.push({ url: url.replace('http://api.test/api', ''), ...options });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next ?? reply(500, { detail: 'нет ответа в тесте' });
    })
  );
  // в Node нет navigator.geolocation → locate() сразу отвечает «unavailable»
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('вход', () => {
  it('registerUser: 409 («номер уже есть») превращается во вход по коду', async () => {
    const api = await loadApi();
    responses = [
      reply(409, { detail: 'Этот номер уже зарегистрирован' }),
      reply(200, { step: 2, phone: '+79120000001' }),
    ];

    const result = await api.registerUser({
      name: 'Полина Исупова',
      phone: '+79120000001',
      city: 'Москва',
      geolocationEnabled: true,
    });

    expect(calls.map((c) => c.url)).toEqual(['/auth/register', '/auth/login']);
    expect(JSON.parse(calls[1].body)).toEqual({ phone: '+79120000001' });
    expect(result.step).toBe(2);
  });

  it('registerUser: другие ошибки (429) не маскируются и несут текст сервера', async () => {
    const api = await loadApi();
    responses = [reply(429, { detail: 'Код уже отправлен. Новый можно запросить через 40 с' })];

    await expect(
      api.registerUser({ name: 'Полина', phone: '+79120000001', city: 'Москва' })
    ).rejects.toMatchObject({ status: 429, message: expect.stringContaining('через 40 с') });
    expect(calls).toHaveLength(1);
  });

  it('loginUser шлёт только номер', async () => {
    const api = await loadApi();
    responses = [reply(200, { step: 2, phone: '+79120000001' })];

    await api.loginUser('+79120000001');

    expect(calls[0].url).toBe('/auth/login');
    expect(JSON.parse(calls[0].body)).toEqual({ phone: '+79120000001' });
  });

  it('ответ 401 стирает токен, а дашборд перезагружается как гостевой', async () => {
    const api = await loadApi();
    storage.set('safe_city_token', 'old-token');
    const guest = {
      isAuthenticated: false,
      user: null,
      reference: {
        services: [],
        guides: [],
        incidentTypes: [],
        mapCategories: [],
        cities: [],
        sosWaitingTips: [],
        reportNextSteps: [],
        maxContacts: 5,
      },
      alerts: [],
      places: [],
      incidents: [],
      contacts: [],
      activeSos: null,
      moderation: null,
    };
    responses = [reply(401, { detail: 'Сессия истекла' }), reply(200, guest)];

    const data = await api.getDashboardData();

    expect(storage.has('safe_city_token')).toBe(false);
    expect(calls[0].headers.Authorization).toBe('Bearer old-token');
    expect(calls[1].headers.Authorization).toBeUndefined();
    expect(data.isAuthenticated).toBe(false);
  });
});

describe('SOS', () => {
  const sosReply = (overrides = {}) => ({
    id: 1,
    status: 'active',
    lat: null,
    lng: null,
    address: null,
    accuracyMeters: null,
    startedAt: '2026-11-10T12:00:00Z',
    notifiedContacts: [],
    ...overrides,
  });

  it('sendSosSignal отправляет сигнал сразу, не ожидая геолокации', async () => {
    const api = await loadApi();
    responses = [reply(201, sosReply())];

    const sos = await api.sendSosSignal({ address: 'Красная площадь' });

    expect(calls[0].url).toBe('/sos');
    expect(JSON.parse(calls[0].body)).toEqual({ address: 'Красная площадь' });
    expect(sos.id).toBe(1);
  });

  it('cancelSosSignal пробрасывает ошибку сети — экран SOS не закроется молча', async () => {
    const api = await loadApi();
    responses = [new TypeError('Failed to fetch')];

    await expect(api.cancelSosSignal(1)).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('Нет связи'),
    });
  });

  it('cancelSosSignal пробрасывает ответ сервера об ошибке', async () => {
    const api = await loadApi();
    responses = [reply(500, { detail: 'Сервер недоступен' })];

    await expect(api.cancelSosSignal(1)).rejects.toMatchObject({ status: 500 });
  });

  it('resolveSos вызывает эндпоинт модератора', async () => {
    const api = await loadApi();
    responses = [reply(200, sosReply({ status: 'resolved' }))];

    await api.resolveSos(4);

    expect(calls[0]).toMatchObject({ url: '/moderation/sos/4/resolve', method: 'POST' });
  });
});

describe('метки', () => {
  const payload = {
    typeId: 'fire',
    address: ' ул. Никольская, 10 ',
    description: ' Задымление ',
    anonymous: false,
  };

  it('место из формы уходит вместе с меткой, без подстановок из макета', async () => {
    const api = await loadApi();
    responses = [reply(201, { id: 12 })];

    const result = await api.submitIncidentReport({
      ...payload,
      coordinates: { lat: 55.757, lng: 37.623 },
    });

    expect(JSON.parse(calls[0].body)).toEqual({
      type: 'fire',
      description: 'Задымление',
      address: 'ул. Никольская, 10',
      isAnonymous: false,
      lat: 55.757,
      lng: 37.623,
    });
    expect(result.incident.id).toBe('#12');
  });

  it('если фото не загрузились, метка уже создана: ошибки нет, есть photoError', async () => {
    const api = await loadApi();
    responses = [reply(201, { id: 12 }), reply(413, { detail: 'a.png: фото больше 5 МБ' })];
    const file = { name: 'a.png' };

    const result = await api.submitIncidentReport({ ...payload, photoFiles: [file] });

    expect(result.incident.id).toBe('#12');
    expect(result.photoError).toContain('больше 5 МБ');
    expect(calls.map((c) => c.url)).toEqual(['/incidents', '/incidents/12/photos']);
  });

  it('нет места: понятная подсказка про геолокацию вместо сухой ошибки сервера', async () => {
    const api = await loadApi();
    responses = [reply(400, { detail: 'Укажите место на карте или включите геолокацию' })];

    await expect(api.submitIncidentReport(payload)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('значок замка'),
    });
  });

  it('ошибки валидации 422 показываются по-русски, как прислал сервер', async () => {
    const api = await loadApi();
    responses = [
      reply(422, {
        detail: [
          { type: 'string_too_short', loc: ['body', 'name'], msg: 'Имя: не короче 2 символов' },
        ],
      }),
    ];

    await expect(api.loginUser('+79120000001')).rejects.toMatchObject({
      message: 'Имя: не короче 2 символов',
    });
  });
});
