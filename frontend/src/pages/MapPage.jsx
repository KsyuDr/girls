import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Home,
  Plus,
  Minus,
  Shield,
  TriangleAlert,
  Flame,
  Siren,
  Search,
  LocateFixed,
  Maximize2,
  Navigation,
  Phone,
  Clock,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { AppSidebar, AccountMenu, MobileTabbar } from '../components/AppShell';
import { plural, elapsedLabel } from '../services/adapters';
import './MapPage.css';

const CityMap = lazy(() => import('../components/CityMap'));

const PLACE_ICONS = {
  home: Home,
  plus: Plus,
  shield: Shield,
  'triangle-alert': TriangleAlert,
  flame: Flame,
};

function hasPoint(p) {
  return typeof p?.lat === 'number' && typeof p?.lng === 'number';
}

function osmUrl(p) {
  return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
}

const placesLabel = (n) => `${n} ${plural(n, 'место', 'места', 'мест')}`;

/** Карточка выбранной точки: место, метка жителя или SOS. */
function SelectionCard({ item, now, onClose }) {
  const isSos = item.kind === 'sos';
  const Icon = isSos ? Siren : PLACE_ICONS[item.icon] || Home;
  return (
    <article className={`map-card ${isSos ? 'map-card--sos' : ''}`} aria-live="polite">
      <div className="map-card__head">
        <div
          className="map-card__icon"
          style={isSos ? undefined : { backgroundColor: item.iconBg, color: item.iconColor }}
        >
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="map-card__titles">
          <h2 className="map-card__title">{item.title}</h2>
          <p className="map-card__address">{item.address}</p>
        </div>
        <button
          type="button"
          className="map-card__close"
          onClick={onClose}
          aria-label="Закрыть карточку"
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="map-card__meta">
        {isSos ? (
          <>
            <span className="map-card__chip map-card__chip--sos">Активный SOS</span>
            <span className="map-card__meta-item">
              <Clock size={15} strokeWidth={2} aria-hidden="true" />
              {elapsedLabel(now - item.startedAt)}
            </span>
            {item.relation && (
              <span className="map-card__meta-item">Вы записаны как «{item.relation}»</span>
            )}
          </>
        ) : (
          <>
            <span
              className="map-card__chip"
              style={{ backgroundColor: item.badgeBg, color: item.badgeColor }}
            >
              {item.badgeText}
            </span>
            {item.hoursLabel && (
              <span className="map-card__meta-item">
                <Clock size={15} strokeWidth={2} aria-hidden="true" />
                {item.hoursLabel}
              </span>
            )}
            {item.distanceLabel && item.distanceLabel !== 'расстояние неизвестно' && (
              <span className="map-card__meta-item">
                <Navigation size={15} strokeWidth={2} aria-hidden="true" />
                {item.distanceLabel} · {item.walkTimeLabel}
              </span>
            )}
          </>
        )}
      </div>

      {item.description && <p className="map-card__description">{item.description}</p>}
      {item.photos?.length > 0 && (
        <ul className="map-card__photos" aria-label="Фото к метке">
          {item.photos.map((photo, index) => (
            <li key={photo.id}>
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={photo.url}
                  alt={`Фото ${index + 1} к метке «${item.title}»`}
                  loading="lazy"
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="map-card__actions">
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            className={`map-card__btn ${isSos ? 'map-card__btn--danger' : 'map-card__btn--primary'}`}
          >
            <Phone size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>
              {isSos
                ? `Позвонить ${item.displayPhone || ''}`
                : item.phone === '112'
                  ? 'Позвонить 112'
                  : 'Позвонить'}
            </span>
          </a>
        )}
        {hasPoint(item) && (
          <a
            href={osmUrl(item)}
            target="_blank"
            rel="noopener noreferrer"
            className="map-card__btn"
          >
            <Navigation size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Открыть в OSM</span>
          </a>
        )}
      </div>
    </article>
  );
}

export default function MapPage({
  user,
  categories = [],
  places = [],
  center = null,
  focus = null,
  sosPoints = [],
  onClearFocus,
  onNavigate,
}) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null); // null — все категории
  const [selectedId, setSelectedId] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [fitKey, setFitKey] = useState(null);
  const [zoomRequest, setZoomRequest] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [locateError, setLocateError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const listRef = useRef(null);
  // Номер запроса к карте (перелёт, масштаб): новый номер — новое действие
  const requestRef = useRef(0);
  const nextKey = () => {
    requestRef.current += 1;
    return requestRef.current;
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const userPoint = deviceLocation || (user?.hasLocation ? { lat: user.lat, lng: user.lng } : null);

  // SOS — всегда на карте, вне фильтров
  const sosItems = useMemo(
    () =>
      sosPoints.filter(hasPoint).map((s) => ({
        ...s,
        id: `sos-${s.kind}-${s.id}`,
        sosId: s.id,
        kind: 'sos',
        sosKind: s.kind,
        title: `SOS: ${s.senderName || s.userName}`,
        address: s.address,
        icon: 'siren',
        color: '#ED0536',
      })),
    [sosPoints]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlaces = places.filter((place) => {
    if (activeCategory && place.category !== activeCategory) return false;
    if (!normalizedQuery) return true;
    return [place.title, place.address, place.subtitle].some((v) =>
      v?.toLowerCase().includes(normalizedQuery)
    );
  });

  const counts = useMemo(() => {
    const result = {};
    places.forEach((p) => {
      result[p.category] = (result[p.category] || 0) + 1;
    });
    return result;
  }, [places]);

  const markers = useMemo(
    () => [
      ...filteredPlaces.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        color: p.pinColor,
        icon: p.icon,
        label: `${p.title} — ${p.address}`,
        kind: 'place',
      })),
      ...sosItems.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        color: '#ED0536',
        icon: 'siren',
        label: `${s.title} — ${s.address}`,
        kind: 'sos',
      })),
    ],
    [filteredPlaces, sosItems]
  );

  const selected =
    sosItems.find((s) => s.id === selectedId) || places.find((p) => p.id === selectedId) || null;

  // Пришли с запросом «показать на карте» (SOS из баннера или из панели модератора)
  useEffect(() => {
    if (!focus) return;
    const id =
      focus.type === 'incoming-sos'
        ? `sos-incoming-${focus.id}`
        : focus.type === 'sos'
          ? `sos-moderation-${focus.id}`
          : focus.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- внешний запрос фокуса приходит пропом
    setSelectedId(id);
    setFlyTo({ lat: focus.lat, lng: focus.lng, zoom: 16, key: nextKey() });
    setSheetOpen(false);
    onClearFocus?.();
  }, [focus, onClearFocus]);

  const select = (item, { fly = true } = {}) => {
    setSelectedId(item.id);
    if (fly && hasPoint(item)) {
      setFlyTo({ lat: item.lat, lng: item.lng, key: nextKey() });
    }
    setSheetOpen(false);
  };

  const handleMarkerSelect = (id) => {
    setSelectedId(id);
    setSheetOpen(false);
    // В списке подсвечиваем и прокручиваем к выбранному месту
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`[data-place-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  };

  const handleLocate = () => {
    setLocateError('');
    const fallback = () => {
      if (userPoint) {
        setFlyTo({ ...userPoint, zoom: 15, key: nextKey() });
      } else {
        setLocateError('Не удалось определить место. Разрешите доступ к геолокации в браузере.');
      }
    };
    if (!navigator.geolocation) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDeviceLocation(point);
        setFlyTo({ ...point, zoom: 15, key: nextKey() });
      },
      fallback,
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  };

  const nearbyKnown = Boolean(userPoint);
  const listTitle = nearbyKnown ? 'Рядом с вами' : 'В городе';

  return (
    <div className="map-page">
      <AppSidebar />

      <div className="map-shell page-enter page-enter--fade">
        <header className="map-header">
          <div className="map-header__titles">
            <h1 className="map-header__title">Карта</h1>
            <p className="map-header__subtitle">
              {nearbyKnown
                ? 'Опасные места и пункты помощи рядом с вами'
                : 'Опасные места и пункты помощи в городе'}
            </p>
          </div>
          <div className="map-header__actions">
            <button
              type="button"
              className="map-header__report"
              onClick={() => onNavigate?.('report')}
            >
              <TriangleAlert size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>Сообщить о происшествии</span>
            </button>
            <AccountMenu className="map-header__avatar" />
          </div>
        </header>

        <div className="map-body">
          <aside
            className={`map-panel ${sheetOpen ? 'map-panel--open' : ''} ${
              selected ? 'map-panel--has-selection' : ''
            }`}
            aria-label="Места на карте"
          >
            <button
              type="button"
              className="map-panel__handle"
              onClick={() => setSheetOpen((v) => !v)}
              aria-expanded={sheetOpen}
            >
              <span className="map-panel__grip" aria-hidden="true" />
              <span className="map-panel__handle-text">
                {sheetOpen
                  ? 'Свернуть список'
                  : `${listTitle}: ${placesLabel(filteredPlaces.length)}`}
              </span>
              {sheetOpen ? (
                <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
              ) : (
                <ChevronUp size={18} strokeWidth={2} aria-hidden="true" />
              )}
            </button>

            <search className="map-panel__search">
              <Search size={18} strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSheetOpen(true)}
                placeholder="Поиск адреса или места"
                aria-label="Поиск адреса или места"
              />
            </search>

            <div className="map-panel__chips" role="group" aria-label="Что показать на карте">
              <button
                type="button"
                aria-pressed={activeCategory === null}
                className={`map-chip ${activeCategory === null ? 'map-chip--active' : ''}`}
                onClick={() => setActiveCategory(null)}
              >
                Все <span className="map-chip__count">{places.length}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={activeCategory === cat.id}
                  className={`map-chip ${activeCategory === cat.id ? 'map-chip--active' : ''}`}
                  onClick={() => setActiveCategory((prev) => (prev === cat.id ? null : cat.id))}
                >
                  <span
                    className="map-chip__dot"
                    style={{ backgroundColor: cat.dotColor }}
                    aria-hidden="true"
                  />
                  {cat.label}
                  <span className="map-chip__count">{counts[cat.id] || 0}</span>
                </button>
              ))}
            </div>

            {selected && (
              <div className="map-panel__selection">
                <SelectionCard item={selected} now={now} onClose={() => setSelectedId(null)} />
              </div>
            )}

            <div className="map-panel__scroll" ref={listRef}>
              {sosItems.length > 0 && (
                <section className="map-list" aria-label="Активные сигналы SOS">
                  <h2 className="map-list__title map-list__title--sos">
                    Сигналы SOS <span>{sosItems.length}</span>
                  </h2>
                  {sosItems.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      data-place-id={s.id}
                      onClick={() => select(s)}
                      aria-current={selectedId === s.id ? 'true' : undefined}
                      className={`map-item map-item--sos ${
                        selectedId === s.id ? 'map-item--active' : ''
                      }`}
                    >
                      <span className="map-item__icon map-item__icon--sos">
                        <Siren size={18} strokeWidth={2.2} aria-hidden="true" />
                      </span>
                      <span className="map-item__text">
                        <span className="map-item__title">{s.title}</span>
                        <span className="map-item__sub">
                          {s.address} · {elapsedLabel(now - s.startedAt)}
                        </span>
                      </span>
                    </button>
                  ))}
                </section>
              )}

              <section className="map-list" aria-label={listTitle}>
                <h2 className="map-list__title">
                  {listTitle} <span>{placesLabel(filteredPlaces.length)}</span>
                </h2>
                {filteredPlaces.length === 0 && (
                  <p className="map-list__empty">
                    {places.length === 0
                      ? 'Точек на карте пока нет.'
                      : 'Ничего не нашлось. Измените запрос или фильтр.'}
                  </p>
                )}
                {filteredPlaces.map((place) => {
                  const Icon = PLACE_ICONS[place.icon] || Home;
                  const active = selectedId === place.id;
                  return (
                    <button
                      key={place.id}
                      type="button"
                      data-place-id={place.id}
                      onClick={() => select(place)}
                      aria-current={active ? 'true' : undefined}
                      className={`map-item ${active ? 'map-item--active' : ''}`}
                    >
                      <span
                        className="map-item__icon"
                        style={{ backgroundColor: place.iconBg, color: place.iconColor }}
                      >
                        <Icon size={18} strokeWidth={2} aria-hidden="true" />
                      </span>
                      <span className="map-item__text">
                        <span className="map-item__title">{place.title}</span>
                        <span className="map-item__sub">{place.subtitle}</span>
                      </span>
                      <span
                        className="map-item__badge"
                        style={{ backgroundColor: place.badgeBg, color: place.badgeColor }}
                      >
                        {place.badgeText}
                      </span>
                    </button>
                  );
                })}
              </section>
            </div>
          </aside>

          <section className="map-stage" aria-label="Карта города">
            <Suspense fallback={<div className="map-stage__loading">Загружаем карту…</div>}>
              <CityMap
                center={userPoint || center}
                userPoint={userPoint}
                markers={markers}
                selectedId={selectedId}
                onSelect={handleMarkerSelect}
                flyTo={flyTo}
                fitKey={fitKey}
                zoomRequest={zoomRequest}
                ariaLabel="Карта: опасные места, пункты помощи и сигналы SOS"
              />
            </Suspense>

            <div className="map-controls">
              <div className="map-controls__group">
                <button
                  type="button"
                  className="map-controls__btn"
                  onClick={() => setZoomRequest({ delta: 1, key: nextKey() })}
                  aria-label="Приблизить"
                  title="Приблизить"
                >
                  <Plus size={20} strokeWidth={2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="map-controls__btn"
                  onClick={() => setZoomRequest({ delta: -1, key: nextKey() })}
                  aria-label="Отдалить"
                  title="Отдалить"
                >
                  <Minus size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                className="map-controls__btn map-controls__btn--single"
                onClick={() => setFitKey(nextKey())}
                aria-label="Показать все точки"
                title="Показать все точки"
              >
                <Maximize2 size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="map-controls__btn map-controls__btn--single map-controls__btn--locate"
                onClick={handleLocate}
                aria-label="Моё местоположение"
                title="Моё местоположение"
              >
                <LocateFixed size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {locateError && (
              <div className="map-stage__toast" role="status">
                <span>{locateError}</span>
                <button type="button" onClick={() => setLocateError('')} aria-label="Закрыть">
                  <X size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            )}

            <button
              type="button"
              className="map-stage__report-fab"
              onClick={() => onNavigate?.('report')}
            >
              <TriangleAlert size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>Сообщить</span>
            </button>
          </section>
        </div>
      </div>

      <MobileTabbar />
    </div>
  );
}
