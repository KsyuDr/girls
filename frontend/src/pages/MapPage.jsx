import { useState } from 'react';
import {
  ShieldCheck,
  Home,
  Bell,
  Map,
  TriangleAlert,
  Users,
  BookOpen,
  Siren,
  Search,
  Plus,
  Minus,
  Shield,
  Flame,
  Navigation,
  LocateFixed,
  Clock,
  Phone,
  Filter,
  LayoutDashboard,
  Check,
} from 'lucide-react';
import './MapPage.css';

const PLACE_ICONS = {
  home: Home,
  plus: Plus,
  shield: Shield,
  'triangle-alert': TriangleAlert,
  flame: Flame,
};

export default function MapPage({ user, categories = [], places = [], onNavigate, onTriggerSos }) {
  const [topSearch, setTopSearch] = useState('');
  const [placeSearch, setPlaceSearch] = useState('');
  // null означает «показаны все категории» (в макете по умолчанию чип «Опасные места» подсвечен, но в списке видны все 5 мест)
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0]?.id || 'plc_1');
  const [zoom, setZoom] = useState(1);
  const [routeActiveId, setRouteActiveId] = useState(null);

  const combinedQuery = (placeSearch || topSearch).trim().toLowerCase();

  const filteredPlaces = places.filter((place) => {
    const matchesCategory = !activeCategory || place.category === activeCategory;
    const matchesQuery =
      !combinedQuery ||
      place.title.toLowerCase().includes(combinedQuery) ||
      place.address.toLowerCase().includes(combinedQuery) ||
      place.subtitle.toLowerCase().includes(combinedQuery);
    return matchesCategory && matchesQuery;
  });

  const selectedPlace =
    filteredPlaces.find((p) => p.id === selectedPlaceId) ||
    places.find((p) => p.id === selectedPlaceId) ||
    filteredPlaces[0] ||
    places[0];

  const handleChipClick = (catId) => {
    setActiveCategory((prev) => (prev === catId ? null : catId));
  };

  const handleZoomIn = () => setZoom((z) => Math.min(1.35, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.85, +(z - 0.15).toFixed(2)));
  const handleResetView = () => {
    setZoom(1);
    setRouteActiveId(null);
  };

  const navItems = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'alerts', label: 'Оповещения', icon: Bell },
    { id: 'map', label: 'Карта', icon: Map },
    { id: 'report', label: 'Сообщить', icon: TriangleAlert },
    { id: 'contacts', label: 'Контакты', icon: Users },
    { id: 'guides', label: 'Службы и памятки', icon: BookOpen },
    { id: 'operator', label: 'Панель служб', icon: LayoutDashboard },
  ];

  const getPlacesCountLabel = (count) => {
    if (count === 1) return '1 место';
    if (count >= 2 && count <= 4) return `${count} места`;
    return `${count} мест`;
  };

  return (
    <div className="map-layout" data-node-id="3149:1617">
      {/* Боковая панель (Десктоп MacBook Pro 14") */}
      <aside className="sos-sidebar" data-node-id="3149:1689">
        <div className="sos-sidebar__top" data-node-id="3149:1669">
          <div className="sos-sidebar__logo" data-node-id="3149:1627">
            <div className="sos-sidebar__logo-icon" data-node-id="3149:1623">
              <ShieldCheck size={22} color="#003C54" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div className="sos-sidebar__logo-text" data-node-id="3149:1626">
              <span className="sos-sidebar__brand" data-node-id="3149:1624">
                Безопасный город
              </span>
              <span className="sos-sidebar__city" data-node-id="3149:1625">
                {user?.city || 'Москва'}
              </span>
            </div>
          </div>

          <nav
            className="sos-sidebar__nav"
            aria-label="Основная навигация"
            data-node-id="3149:1668"
          >
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === 'map';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  className={`sos-sidebar__nav-item ${
                    isActive ? 'sos-sidebar__nav-item--active' : ''
                  }`}
                >
                  <IconComponent
                    size={20}
                    color={isActive ? '#00C9B7' : 'rgba(255, 255, 255, 0.75)'}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sos-sidebar__bottom" data-node-id="3149:1688">
          <button
            type="button"
            onClick={() => onTriggerSos?.()}
            className="sos-sidebar__sos-btn"
            data-node-id="3149:1687"
          >
            <Siren size={20} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
            <span>Экстренный вызов SOS</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('register')}
            className="sos-sidebar__profile"
            data-node-id="3149:1675"
          >
            <div className="sos-sidebar__avatar" data-node-id="3149:1671">
              <span>{user?.initials || 'ПА'}</span>
            </div>
            <div className="sos-sidebar__profile-info" data-node-id="3149:1674">
              <span className="sos-sidebar__profile-name" data-node-id="3149:1672">
                {user?.mobileName || 'Полина Исупова'}
              </span>
              <span className="sos-sidebar__profile-phone" data-node-id="3149:1673">
                {user?.displayPhone || '+7 912 345-67-89'}
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* Основная рабочая область */}
      <div className="map-main" data-node-id="3149:1618">
        {/* Верхняя панель (Десктоп) */}
        <header className="map-topbar" data-node-id="3149:1615">
          <div className="map-topbar__titles" data-node-id="3149:1599">
            <h1 className="map-topbar__title" data-node-id="3149:1597">
              Карта
            </h1>
            <p className="map-topbar__subtitle" data-node-id="3149:1598">
              Опасные места и пункты помощи рядом с вами
            </p>
          </div>

          <div className="map-topbar__actions" data-node-id="3149:1614">
            <search className="map-topbar__search" data-node-id="3149:1605">
              <Search size={18} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                placeholder="Поиск по сайту"
                aria-label="Поиск по сайту"
                className="map-topbar__search-input"
              />
            </search>

            <button
              type="button"
              onClick={() => onNavigate?.('alerts')}
              className="map-topbar__bell"
              aria-label="Перейти к оповещениям"
              title="Оповещения"
              data-node-id="3149:1610"
            >
              <Bell size={22} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
              <span className="map-topbar__bell-dot" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('register')}
              className="map-topbar__avatar"
              title="Профиль пользователя"
              data-node-id="3149:1613"
            >
              {user?.initials || 'ПА'}
            </button>
          </div>
        </header>

        {/* Основной ряд: Список мест слева (Десктоп) + Интерактивная карта */}
        <div className="map-content-row" data-node-id="3149:1616">
          {/* Левая колонка: Поиск, фильтры и список мест (Десктоп) */}
          <aside
            className="map-places-panel"
            aria-label="Места рядом с вами"
            data-node-id="3149:1492"
          >
            <search className="map-places-search" data-node-id="3149:1414">
              <Search size={18} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={placeSearch}
                onChange={(e) => setPlaceSearch(e.target.value)}
                placeholder="Поиск адреса или места"
                aria-label="Поиск адреса или места"
                className="map-places-search__input"
              />
            </search>

            <div
              className="map-filter-chips"
              role="group"
              aria-label="Фильтр объектов на карте"
              data-node-id="3149:1427"
            >
              {categories.map((cat, idx) => {
                // В макете первый чип («Опасные места») визуально выделен по умолчанию
                const isSelected =
                  activeCategory === cat.id || (activeCategory === null && idx === 0);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleChipClick(cat.id)}
                    aria-pressed={activeCategory === cat.id}
                    className={`map-chip ${isSelected ? 'map-chip--active' : ''}`}
                  >
                    <span
                      className="map-chip__dot"
                      style={{ backgroundColor: cat.dotColor }}
                      aria-hidden="true"
                    />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="map-places-header" data-node-id="3149:1430">
              <h2 className="map-places-header__title" data-node-id="3149:1429">
                Рядом с вами
              </h2>
              <span className="map-places-header__count" data-node-id="3149:1428">
                {getPlacesCountLabel(filteredPlaces.length)}
              </span>
            </div>

            <div className="map-places-list">
              {filteredPlaces.map((place) => {
                const IconComponent = PLACE_ICONS[place.icon] || Home;
                const isSelected = selectedPlace?.id === place.id;
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => setSelectedPlaceId(place.id)}
                    className={`map-place-item ${isSelected ? 'map-place-item--active' : ''}`}
                  >
                    <div className="map-place-item__icon" style={{ backgroundColor: place.iconBg }}>
                      <IconComponent
                        size={20}
                        color={place.iconColor}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="map-place-item__info">
                      <span className="map-place-item__title">{place.title}</span>
                      <span className="map-place-item__subtitle">{place.subtitle}</span>
                    </div>
                    <span
                      className="map-place-item__badge"
                      style={{
                        backgroundColor: place.badgeBg,
                        color: place.badgeColor,
                      }}
                    >
                      {place.badgeText}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Правая область (и мобильный полноэкранный вид): Карта */}
          <section
            className="map-viewport"
            aria-label="Интерактивная карта города"
            data-node-id="3149:1596"
          >
            {/* Мобильные плавающие элементы поверх карты (iPhone 16 / 08 Карта · 3149:3055) */}
            <div className="map-mobile-overlay-top">
              <div className="map-mobile-search-bar" data-node-id="3149:3030">
                <Search size={18} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
                <input
                  type="search"
                  value={placeSearch}
                  onChange={(e) => setPlaceSearch(e.target.value)}
                  placeholder="Поиск адреса или места"
                  aria-label="Поиск адреса или места"
                  className="map-mobile-search-bar__input"
                />
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className="map-mobile-search-bar__filter"
                  aria-label="Сбросить фильтры"
                  title="Сбросить фильтры"
                >
                  <Filter size={18} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              <div className="map-mobile-chips" data-node-id="3149:3043">
                {categories.map((cat, idx) => {
                  const isSelected =
                    activeCategory === cat.id || (activeCategory === null && idx === 0);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleChipClick(cat.id)}
                      className={`map-chip ${isSelected ? 'map-chip--active' : ''}`}
                    >
                      <span
                        className="map-chip__dot"
                        style={{ backgroundColor: cat.dotColor }}
                        aria-hidden="true"
                      />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Масштабируемое полотно карты */}
            <div className="map-canvas" style={{ transform: `scale(${zoom})` }}>
              {/* Река */}
              <div className="map-river" aria-hidden="true" />

              {/* Кварталы и парковые зоны */}
              <div className="map-blocks-grid" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, index) => {
                  const isPark = index === 5 || index === 9 || index === 16 || index === 20;
                  return (
                    <div
                      key={index}
                      className={`map-city-block ${isPark ? 'map-city-block--park' : ''}`}
                    />
                  );
                })}
              </div>

              {/* Главные магистрали */}
              <div className="map-road map-road--h1" aria-hidden="true" />
              <div className="map-road map-road--h2" aria-hidden="true" />
              <div className="map-road map-road--v1" aria-hidden="true" />
              <div className="map-road map-road--v2" aria-hidden="true" />

              {/* Линия маршрута при активации кнопки «Маршрут» */}
              {routeActiveId && selectedPlace && (
                <svg
                  className="map-route-svg"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1="46"
                    y1="57"
                    x2={parseFloat(selectedPlace.desktopPos.left)}
                    y2={parseFloat(selectedPlace.desktopPos.top)}
                    stroke="#007DA5"
                    strokeWidth="0.9"
                    strokeDasharray="2.2 1.4"
                  />
                </svg>
              )}

              {/* Радиус опасной зоны */}
              <div
                className="map-danger-zone"
                style={{ left: '34%', top: '36%' }}
                data-node-id="3149:1525"
                aria-hidden="true"
              />

              {/* Маркер «Моё местоположение» */}
              <div
                className="map-user-location"
                style={{ left: '46%', top: '57%' }}
                title={`Вы здесь: ${user?.address || 'ул. Малышева, 51'}`}
                data-node-id="3149:1526"
              >
                <div className="map-user-location__pulse" />
                <div className="map-user-location__dot" />
              </div>

              {/* Интерактивные пины объектов */}
              {filteredPlaces.map((place) => {
                const PinIcon = PLACE_ICONS[place.icon] || Home;
                const isSelected = selectedPlace?.id === place.id;
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => setSelectedPlaceId(place.id)}
                    style={{
                      left: place.desktopPos.left,
                      top: place.desktopPos.top,
                      backgroundColor: place.pinColor,
                    }}
                    className={`map-pin ${isSelected ? 'map-pin--selected' : ''}`}
                    aria-label={`${place.title} — ${place.address}`}
                  >
                    <PinIcon size={20} color="#FFFFFF" strokeWidth={2.2} aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            {/* Всплывающая карточка выбранного места на карте (Десктоп · 3149:1563) */}
            {selectedPlace && (
              <div className="map-popup-card" data-node-id="3149:1563">
                <div className="map-popup-card__head" data-node-id="3149:1554">
                  <h3 className="map-popup-card__title" data-node-id="3149:1551">
                    {selectedPlace.title}
                  </h3>
                  <span
                    className="map-popup-card__badge"
                    style={{
                      backgroundColor: selectedPlace.badgeBg,
                      color: selectedPlace.badgeColor,
                    }}
                    data-node-id="3149:1553"
                  >
                    {selectedPlace.badgeText}
                  </span>
                </div>
                <p className="map-popup-card__address" data-node-id="3149:1555">
                  {selectedPlace.shortMeta}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setRouteActiveId((prev) =>
                      prev === selectedPlace.id ? null : selectedPlace.id
                    )
                  }
                  className="map-popup-card__route-btn"
                  data-node-id="3149:1562"
                >
                  {routeActiveId === selectedPlace.id ? (
                    <>
                      <Check size={18} color="#FFFFFF" strokeWidth={2.2} aria-hidden="true" />
                      <span>Маршрут построен ({selectedPlace.walkTimeLabel})</span>
                    </>
                  ) : (
                    <>
                      <Navigation size={18} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
                      <span>Маршрут</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Кнопки управления масштабом и геолокацией справа (Десктоп · 3149:1579) */}
            <div className="map-controls" data-node-id="3149:1579">
              <div className="map-zoom-group" data-node-id="3149:1573">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="map-control-btn"
                  aria-label="Приблизить карту"
                  data-node-id="3149:1567"
                >
                  <Plus size={20} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
                </button>
                <div className="map-zoom-divider" />
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="map-control-btn"
                  aria-label="Отдалить карту"
                  data-node-id="3149:1572"
                >
                  <Minus size={20} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetView}
                className="map-locate-btn"
                aria-label="Моё местоположение"
                title="Центрировать на моём местоположении"
                data-node-id="3149:1578"
              >
                <LocateFixed size={20} color="#007DA5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {/* Легенда карты слева внизу (Десктоп · 3149:1595) */}
            <div className="map-legend" data-node-id="3149:1595">
              <span className="map-legend__title" data-node-id="3149:1580">
                Обозначения
              </span>
              <div className="map-legend__item" data-node-id="3149:1583">
                <span className="map-legend__dot" style={{ backgroundColor: '#ED0536' }} />
                <span>Опасное место</span>
              </div>
              <div className="map-legend__item" data-node-id="3149:1586">
                <span className="map-legend__dot" style={{ backgroundColor: '#008F82' }} />
                <span>Пункт помощи, больница</span>
              </div>
              <div className="map-legend__item" data-node-id="3149:1589">
                <span className="map-legend__dot" style={{ backgroundColor: '#007DA5' }} />
                <span>Полиция</span>
              </div>
              <div className="map-legend__item" data-node-id="3149:1594">
                <span className="map-legend__dot map-legend__dot--user" />
                <span>Вы здесь</span>
              </div>
            </div>

            {/* Мобильные плавающие кнопки над нижней карточкой (3149:3054) */}
            <div className="map-mobile-fab-group">
              <button
                type="button"
                onClick={() => onNavigate?.('report')}
                className="map-mobile-report-fab"
                aria-label="Сообщить о происшествии"
              >
                <TriangleAlert size={18} color="#FFFFFF" strokeWidth={2.2} aria-hidden="true" />
                <span>Сообщить</span>
              </button>

              <button
                type="button"
                onClick={handleResetView}
                className="map-mobile-locate-fab"
                aria-label="Моё местоположение"
                data-node-id="3149:3054"
              >
                <LocateFixed size={22} color="#007DA5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {/* Мобильная нижняя карточка выбранного места (Bottom Sheet · 3149:3049) */}
            {selectedPlace && (
              <div className="map-mobile-sheet" data-node-id="3149:3049">
                <div className="map-mobile-sheet__handle" data-node-id="3149:3044" />

                <div className="map-mobile-sheet__head" data-node-id="3149:3062">
                  <div className="map-mobile-sheet__titles" data-node-id="3149:3059">
                    <h2 className="map-mobile-sheet__title" data-node-id="3149:3057">
                      {selectedPlace.title}
                    </h2>
                    <p className="map-mobile-sheet__address" data-node-id="3149:3058">
                      {selectedPlace.address}
                    </p>
                  </div>
                  <span
                    className="map-mobile-sheet__badge"
                    style={{
                      backgroundColor: selectedPlace.badgeBg,
                      color: selectedPlace.badgeColor,
                    }}
                    data-node-id="3149:3061"
                  >
                    {selectedPlace.badgeText}
                  </span>
                </div>

                <div className="map-mobile-sheet__meta" data-node-id="3149:3075">
                  <div className="map-mobile-sheet__meta-item" data-node-id="3149:3068">
                    <Clock size={16} color="#008F82" strokeWidth={2} aria-hidden="true" />
                    <span>{selectedPlace.hoursLabel}</span>
                  </div>
                  <div className="map-mobile-sheet__meta-item" data-node-id="3149:3074">
                    <Navigation size={16} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                    <span>
                      {selectedPlace.distanceLabel} · {selectedPlace.walkTimeLabel}
                    </span>
                  </div>
                </div>

                <div className="map-mobile-sheet__actions" data-node-id="3149:3089">
                  <button
                    type="button"
                    onClick={() =>
                      setRouteActiveId((prev) =>
                        prev === selectedPlace.id ? null : selectedPlace.id
                      )
                    }
                    className="map-mobile-sheet__route-btn"
                    data-node-id="3149:3082"
                  >
                    <Navigation size={18} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
                    <span>
                      {routeActiveId === selectedPlace.id ? 'Маршрут активен' : 'Маршрут'}
                    </span>
                  </button>

                  <a
                    href={`tel:${selectedPlace.phone || '112'}`}
                    className="map-mobile-sheet__call-btn"
                    data-node-id="3149:3088"
                  >
                    <Phone size={18} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                    <span>Позвонить</span>
                  </a>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Нижняя панель навигации (Мобильная версия iPhone 16 · 3149:3102) */}
      <nav className="home-tabbar" aria-label="Мобильная навигация" data-node-id="3149:3102">
        <button type="button" onClick={() => onNavigate?.('home')} className="home-tabbar__item">
          <Home size={24} strokeWidth={2} aria-hidden="true" />
          <span>Главная</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.('map')}
          className="home-tabbar__item home-tabbar__item--active"
        >
          <Map size={24} strokeWidth={2} aria-hidden="true" />
          <span>Карта</span>
        </button>

        <div className="home-tabbar__sos-slot">
          <button
            type="button"
            onClick={() => onTriggerSos?.()}
            className="home-tabbar__sos-btn"
            data-node-id="3149:3129"
          >
            <span>SOS</span>
          </button>
        </div>

        <button type="button" onClick={() => onNavigate?.('alerts')} className="home-tabbar__item">
          <Bell size={24} strokeWidth={2} aria-hidden="true" />
          <span>Лента</span>
        </button>

        <button type="button" onClick={() => onNavigate?.('guides')} className="home-tabbar__item">
          <BookOpen size={24} strokeWidth={2} aria-hidden="true" />
          <span>Помощь</span>
        </button>
      </nav>
    </div>
  );
}
