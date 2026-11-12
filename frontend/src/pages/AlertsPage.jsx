import { useState, lazy, Suspense } from 'react';
import { Bell, Map, Search, MapPin, Shield, Check, Send, Filter, Maximize2 } from 'lucide-react';
import { AppSidebar, AccountMenu, MobileTabbar } from '../components/AppShell';
import './AlertsPage.css';

// Та же карта, что в разделе «Карта» (Leaflet), — отдельным чанком
const CityMap = lazy(() => import('../components/CityMap'));

const FILTER_CHIPS = [
  { id: 'all', label: 'Все', dotColor: null },
  { id: 'critical', label: 'Критические', dotColor: '#ED0536' },
  { id: 'warning', label: 'Предупреждения', dotColor: '#007DA5' },
  { id: 'info', label: 'Информация', dotColor: '#00C9B7' },
];

export default function AlertsPage({
  user,
  alerts = [],
  mapCenter = null,
  onNavigate,
  onTogglePushNotifications,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedAlertId, setSelectedAlertId] = useState(alerts[0]?.id || 'alt_1');
  const [expandedMobileAlertId, setExpandedMobileAlertId] = useState(null);
  const [sharedFeedback, setSharedFeedback] = useState(false);

  const pushEnabled = user?.pushNotificationsEnabled ?? true;
  const userPoint =
    user?.hasLocation && typeof user.lat === 'number' ? { lat: user.lat, lng: user.lng } : null;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredAlerts = alerts.filter((alert) => {
    const matchesFilter = activeFilter === 'all' || alert.level === activeFilter;
    const matchesSearch =
      !normalizedQuery ||
      alert.title.toLowerCase().includes(normalizedQuery) ||
      alert.description?.toLowerCase().includes(normalizedQuery) ||
      alert.locationLabel?.toLowerCase().includes(normalizedQuery) ||
      alert.sourceLabel?.toLowerCase().includes(normalizedQuery);
    return matchesFilter && matchesSearch;
  });

  const selectedAlert =
    filteredAlerts.find((a) => a.id === selectedAlertId) || filteredAlerts[0] || alerts[0];

  const handleShare = async (alertItem) => {
    if (!alertItem) return;
    const shareText = `${alertItem.title}: ${alertItem.description} (${alertItem.locationLabel} · ${alertItem.sourceLabel})`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      }
    } catch {
      // ignore clipboard error
    }
    setSharedFeedback(true);
    setTimeout(() => setSharedFeedback(false), 2000);
  };

  return (
    <div className="alerts-layout" data-node-id="3149:1306">
      <AppSidebar />

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <div className="alerts-main page-enter" data-node-id="3149:1307">
        {/* ШАПКА ДЕСКТОПА */}
        <header className="alerts-topbar" data-node-id="3149:1304">
          <div className="alerts-topbar__titles" data-node-id="3149:1288">
            <h1 className="alerts-topbar__title" data-node-id="3149:1286">
              Оповещения
            </h1>
            <p className="alerts-topbar__subtitle" data-node-id="3149:1287">
              Сообщения модераторов сервиса
            </p>
          </div>

          <div className="alerts-topbar__actions" data-node-id="3149:1303">
            <search className="alerts-topbar__search" data-node-id="3149:1294">
              <Search size={18} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по сайту"
                aria-label="Поиск по оповещениям"
                className="alerts-topbar__search-input"
              />
            </search>

            <button
              type="button"
              onClick={() => onNavigate?.('alerts')}
              className="alerts-topbar__bell"
              aria-label="Оповещения"
              title="Оповещения"
              data-node-id="3149:1299"
            >
              <Bell size={22} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
              <span className="alerts-topbar__bell-dot" aria-hidden="true" />
            </button>

            <AccountMenu className="alerts-topbar__avatar" />
          </div>
        </header>

        {/* ШАПКА МОБИЛЬНОЙ ВЕРСИИ (07 Лента оповещений · 3149:2969) */}
        <header className="alerts-mobile-header" data-node-id="3149:2969">
          <h1 className="alerts-mobile-title" data-node-id="3149:2968">
            Оповещения
          </h1>
          <button
            type="button"
            onClick={() =>
              setActiveFilter((prev) =>
                prev === 'all'
                  ? 'critical'
                  : prev === 'critical'
                    ? 'warning'
                    : prev === 'warning'
                      ? 'info'
                      : 'all'
              )
            }
            className="alerts-mobile-filter-btn"
            aria-label="Переключить фильтр оповещений"
            data-node-id="3149:2967"
          >
            <Filter size={22} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        {/* ПАНЕЛЬ ФИЛЬТРОВ + ПЕРЕКЛЮЧАТЕЛЬ PUSH-УВЕДОМЛЕНИЙ */}
        <div className="alerts-toolbar" data-node-id="3149:1154">
          <div
            className="alerts-filters"
            role="group"
            aria-label="Фильтр по типу оповещений"
            data-node-id="3149:1145"
          >
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveFilter(chip.id)}
                  className={`alerts-filter-chip ${isActive ? 'alerts-filter-chip--active' : ''}`}
                >
                  {chip.dotColor && (
                    <span
                      className="alerts-filter-chip__dot"
                      style={{ backgroundColor: chip.dotColor }}
                      aria-hidden="true"
                    />
                  )}
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Десктопный переключатель Push-уведомлений */}
          <div className="alerts-push-pill" data-node-id="3149:1153">
            <Bell size={18} color="#007DA5" strokeWidth={2} aria-hidden="true" />
            <span className="alerts-push-pill__label" data-node-id="3149:1150">
              Push-уведомления
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={pushEnabled}
              aria-label="Включить Push-уведомления"
              onClick={() => onTogglePushNotifications?.(!pushEnabled)}
              className={`contacts-switch ${pushEnabled ? 'contacts-switch--on' : ''}`}
              data-node-id="3149:1151"
            >
              <span className="contacts-switch__thumb" />
            </button>
          </div>
        </div>

        {/* МОБИЛЬНАЯ КАРТОЧКА PUSH-УВЕДОМЛЕНИЙ (3149:2963) */}
        <div className="alerts-mobile-push-card" data-node-id="3149:2963">
          <div className="alerts-mobile-push-card__icon" data-node-id="3149:2957">
            <Bell size={18} color="#007DA5" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="alerts-mobile-push-card__info" data-node-id="3149:2960">
            <span className="alerts-mobile-push-card__title" data-node-id="3149:2958">
              {pushEnabled ? 'Push-уведомления включены' : 'Push-уведомления выключены'}
            </span>
            <span className="alerts-mobile-push-card__sub" data-node-id="3149:2959">
              Критические приходят даже в беззвучном режиме
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pushEnabled}
            aria-label="Включить Push-уведомления"
            onClick={() => onTogglePushNotifications?.(!pushEnabled)}
            className={`contacts-switch ${pushEnabled ? 'contacts-switch--on' : ''}`}
            data-node-id="3149:2961"
          >
            <span className="contacts-switch__thumb" />
          </button>
        </div>

        {/* ОСНОВНОЙ РЯД: СПИСОК ОПОВЕЩЕНИЙ СЛЕВА + ДЕТАЛИ СПРАВА */}
        <div className="alerts-content-row" data-node-id="3149:1305">
          {/* Колонка списка оповещений */}
          <div className="alerts-list" data-node-id="3149:1207">
            {filteredAlerts.map((alert) => {
              const isSelected = selectedAlert?.id === alert.id;
              const isMobileExpanded = expandedMobileAlertId === alert.id;
              return (
                <article
                  key={alert.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedAlertId(alert.id);
                    setExpandedMobileAlertId((prev) => (prev === alert.id ? null : alert.id));
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedAlertId(alert.id);
                      setExpandedMobileAlertId((prev) => (prev === alert.id ? null : alert.id));
                    }
                  }}
                  style={{ borderLeftColor: alert.borderColor || alert.accentColor }}
                  className={`alerts-card ${isSelected ? 'alerts-card--selected' : ''}`}
                >
                  <div className="alerts-card__head">
                    <span
                      className="alerts-card__badge"
                      style={{
                        backgroundColor: alert.bgColor,
                        color: alert.accentColor,
                      }}
                    >
                      {alert.badgeText}
                    </span>
                    <span className="alerts-card__time">{alert.timeAgo}</span>
                  </div>

                  <h2 className="alerts-card__title">{alert.title}</h2>
                  <p className="alerts-card__desc">{alert.description || alert.subtitle}</p>

                  <div className="alerts-card__meta">
                    <MapPin size={14} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
                    <span>
                      {alert.locationLabel} · {alert.sourceLabel}
                    </span>
                  </div>

                  {/* На мобильном при клике по карточке раскрываем памятку «Что делать» */}
                  {isMobileExpanded && alert.actionsChecklist?.length > 0 && (
                    <div className="alerts-card__mobile-extra" onClick={(e) => e.stopPropagation()}>
                      <span className="alerts-card__mobile-extra-title">Что делать:</span>
                      {alert.actionsChecklist.map((item, idx) => (
                        <div key={idx} className="alerts-check-row">
                          <div className="alerts-check-row__icon">
                            <Check size={14} color="#008F82" strokeWidth={2.5} aria-hidden="true" />
                          </div>
                          <span className="alerts-check-row__text">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Правая колонка (Десктоп): Детали выбранного оповещения */}
          {selectedAlert && (
            <article className="alerts-detail-card" data-node-id="3149:1285">
              <div className="alerts-detail-card__head" data-node-id="3149:1211">
                <span
                  className="alerts-card__badge"
                  style={{
                    backgroundColor: selectedAlert.bgColor,
                    color: selectedAlert.accentColor,
                  }}
                  data-node-id="3149:1209"
                >
                  {selectedAlert.badgeText}
                </span>
                <span className="alerts-detail-card__time" data-node-id="3149:1210">
                  {selectedAlert.detailedTime || selectedAlert.timeAgo}
                </span>
              </div>

              <h2
                key={`title-${selectedAlert.id}`}
                className="alerts-detail-card__title alerts-swap"
                data-node-id="3149:1212"
              >
                {selectedAlert.title}
              </h2>

              <div className="alerts-detail-card__meta" data-node-id="3149:1224">
                <div className="alerts-detail-card__meta-item" data-node-id="3149:1217">
                  <Shield size={16} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                  <span>{selectedAlert.sourceLabel}</span>
                </div>
                <div className="alerts-detail-card__meta-item" data-node-id="3149:1223">
                  <MapPin size={16} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                  <span>{selectedAlert.locationLabel}</span>
                </div>
              </div>

              <p
                key={`desc-${selectedAlert.id}`}
                className="alerts-detail-card__desc alerts-swap"
                data-node-id="3149:1225"
              >
                {selectedAlert.description || selectedAlert.subtitle}
              </p>

              {/* Мини-карта: у оповещения нет координат, только район — показываем город и вас */}
              <div className="alerts-detail-map" data-node-id="3149:1226">
                <Suspense fallback={<span className="alerts-detail-map__loading" />}>
                  <CityMap
                    center={userPoint || mapCenter}
                    userPoint={userPoint}
                    zoom={userPoint ? 13 : 11}
                    interactive={false}
                    ariaLabel="Карта города"
                    className="alerts-detail-map__map"
                  />
                </Suspense>
                <button
                  type="button"
                  className="alerts-detail-map__hit"
                  onClick={() => onNavigate?.('map')}
                  aria-label={`Открыть карту. Район оповещения: ${selectedAlert.locationLabel}`}
                >
                  <span className="alerts-detail-map__zone">
                    <MapPin size={14} strokeWidth={2.4} aria-hidden="true" />
                    {selectedAlert.locationLabel}
                  </span>
                  <span className="alerts-detail-map__open" aria-hidden="true">
                    <Maximize2 size={16} strokeWidth={2.2} />
                  </span>
                </button>
              </div>

              {/* Чек-лист «Что делать» */}
              {selectedAlert.actionsChecklist?.length > 0 && (
                <div className="alerts-detail-card__checklist">
                  <h3 className="alerts-detail-card__section-title" data-node-id="3149:1252">
                    Что делать
                  </h3>

                  {selectedAlert.actionsChecklist.map((itemText, idx) => (
                    <div key={idx} className="alerts-check-row">
                      <div className="alerts-check-row__icon">
                        <Check size={14} color="#008F82" strokeWidth={2.5} aria-hidden="true" />
                      </div>
                      <span className="alerts-check-row__text">{itemText}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Кнопки действий */}
              <div className="alerts-detail-card__actions" data-node-id="3149:1284">
                <button
                  type="button"
                  onClick={() => onNavigate?.('map')}
                  className="alerts-detail-card__map-btn"
                  data-node-id="3149:1277"
                >
                  <Map size={18} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
                  <span>Показать на карте</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShare(selectedAlert)}
                  className="alerts-detail-card__share-btn"
                  data-node-id="3149:1283"
                >
                  <Send size={18} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                  <span>{sharedFeedback ? 'Скопировано' : 'Поделиться'}</span>
                </button>
              </div>
            </article>
          )}
        </div>
      </div>

      <MobileTabbar />
    </div>
  );
}
