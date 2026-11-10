import { useState, useRef, useEffect } from 'react';
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
  Check,
  Flame,
  Shield,
  HeartPulse,
  Zap,
  MessageCircle,
  Plus,
  MapPin,
  LayoutDashboard,
} from 'lucide-react';
import { plural } from '../services/adapters';
import './HomePage.css';

const SERVICE_ICONS = {
  siren: Siren,
  flame: Flame,
  shield: Shield,
  'heart-pulse': HeartPulse,
  zap: Zap,
};

const ALERT_ICONS = {
  'triangle-alert': TriangleAlert,
  bell: Bell,
  'message-circle': MessageCircle,
};

export default function HomePage({
  user,
  services,
  alerts,
  contacts,
  canModerate = false,
  onNavigate,
  onTriggerSos,
  onConfirmSos,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sosState, setSosState] = useState('idle'); // 'idle' | 'holding'
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef(null);
  const holdStartRef = useRef(null);

  const activeSosContacts = contacts.filter((c) => c.receivesSos);
  const activeRecipientsLabel =
    activeSosContacts.length > 0
      ? activeSosContacts.map((c) => c.mobileShortLabel || c.relation || c.name).join(', ')
      : 'не выбраны';

  const criticalAlertsCount = alerts.filter((a) => a.level === 'critical').length;
  const alertsStatus =
    criticalAlertsCount > 0
      ? `${criticalAlertsCount} ${plural(
          criticalAlertsCount,
          'критическое оповещение',
          'критических оповещения',
          'критических оповещений'
        )}`
      : 'критических оповещений нет';
  // «Включена» — только если место действительно известно (hasLocation нет у мок-пользователя)
  const hasLocation = user.hasLocation !== false;
  const geoStatus = !user.geolocationEnabled
    ? 'Геолокация отключена'
    : hasLocation
      ? 'Геолокация включена'
      : 'Местоположение не определено';
  const accuracyText =
    typeof user.accuracyMeters === 'number' ? ` · точность ${user.accuracyMeters} м` : '';

  const startHold = () => {
    setSosState('holding');
    holdStartRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - holdStartRef.current;
      const pct = Math.min(100, (elapsed / 3000) * 100);
      setHoldProgress(pct);

      if (elapsed >= 3000) {
        holdTimerRef.current = null;
        setSosState('idle');
        setHoldProgress(0);
        (onConfirmSos || onTriggerSos)?.();
      } else {
        holdTimerRef.current = requestAnimationFrame(tick);
      }
    };

    holdTimerRef.current = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      cancelAnimationFrame(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (sosState === 'holding') {
      setSosState('idle');
      setHoldProgress(0);
    }
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) cancelAnimationFrame(holdTimerRef.current);
    };
  }, []);

  const handleNavClick = (navId) => {
    onNavigate?.(navId);
  };

  const navItems = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'alerts', label: 'Оповещения', icon: Bell },
    { id: 'map', label: 'Карта', icon: Map },
    { id: 'report', label: 'Сообщить', icon: TriangleAlert },
    { id: 'contacts', label: 'Контакты', icon: Users },
    { id: 'guides', label: 'Службы и памятки', icon: BookOpen },
    ...(canModerate ? [{ id: 'operator', label: 'Панель модератора', icon: LayoutDashboard }] : []),
  ];

  const mobileServices = services.filter((s) => s.showOnMobileHome);
  const latestAlert = alerts[0];
  const homePreviewContacts = activeSosContacts.slice(0, 3);

  return (
    <div className="home-page" data-node-id="3149:292">
      {/* Боковое меню (Десктоп MacBook Pro 14") */}
      <aside className="home-sidebar" data-node-id="3149:364">
        <div className="home-sidebar__top" data-node-id="3149:344">
          <div className="home-sidebar__logo" data-node-id="3149:302">
            <div className="home-sidebar__logo-icon" data-node-id="3149:298">
              <ShieldCheck size={22} color="#003C54" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div className="home-sidebar__logo-text" data-node-id="3149:301">
              <span className="home-sidebar__brand" data-node-id="3149:299">
                Безопасный город
              </span>
              <span className="home-sidebar__city" data-node-id="3149:300">
                {user.city}
              </span>
            </div>
          </div>

          <nav
            className="home-sidebar__nav"
            aria-label="Основная навигация"
            data-node-id="3149:343"
          >
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === 'home';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`home-sidebar__nav-item ${
                    isActive ? 'home-sidebar__nav-item--active' : ''
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

        <div className="home-sidebar__bottom" data-node-id="3149:363">
          <button
            type="button"
            onClick={() => onTriggerSos?.()}
            className="home-sidebar__sos-btn"
            data-node-id="3149:362"
          >
            <Siren size={20} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
            <span>Экстренный вызов SOS</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('register')}
            className="home-sidebar__profile"
            title="Перейти к анкете регистрации"
            data-node-id="3149:350"
          >
            <div className="home-sidebar__avatar" data-node-id="3149:346">
              <span>{user.initials}</span>
            </div>
            <div className="home-sidebar__profile-info" data-node-id="3149:349">
              <span className="home-sidebar__profile-name" data-node-id="3149:347">
                {user.mobileName}
              </span>
              <span className="home-sidebar__profile-phone" data-node-id="3149:348">
                {user.displayPhone}
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* Основная рабочая область */}
      <main className="home-main" data-node-id="3149:293">
        {/* Верхняя панель (Topbar) */}
        <header className="home-topbar" data-node-id="3149:289">
          <div className="home-topbar__title-group" data-node-id="3149:273">
            <h1 className="home-topbar__greeting" data-node-id="3149:271">
              Здравствуйте, {user.firstName}
            </h1>
            <p className="home-topbar__status-desktop" data-node-id="3149:272">
              {user.address} · {alertsStatus}
            </p>
            <p className="home-topbar__status-mobile" data-node-id="3149:2358">
              <MapPin size={14} color="#008F82" strokeWidth={2.2} aria-hidden="true" />
              <span>
                {user.address} ·{' '}
                {hasLocation && user.geolocationEnabled
                  ? 'геолокация вкл.'
                  : geoStatus.toLowerCase()}
              </span>
            </p>
          </div>

          <div className="home-topbar__actions" data-node-id="3149:288">
            <search className="home-topbar__search" data-node-id="3149:279">
              <Search size={18} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по сайту"
                aria-label="Поиск по сайту"
                className="home-topbar__search-input"
              />
            </search>

            <button
              type="button"
              onClick={() => onNavigate?.('alerts')}
              className="home-topbar__bell-btn"
              aria-label="Перейти к оповещениям"
              title="Оповещения"
              data-node-id="3149:284"
            >
              <Bell size={22} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
              <span className="home-topbar__bell-dot" data-node-id="3149:285" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('register')}
              className="home-topbar__avatar"
              title="Профиль"
              data-node-id="3149:287"
            >
              <span>{user.initials}</span>
            </button>
          </div>
        </header>

        {/* Первый ряд: Карточка SOS + Экстренные службы */}
        <div className="home-row" data-node-id="3149:290">
          {/* Карточка SOS */}
          <section className="home-sos-card" data-node-id="3149:147">
            <div className="home-sos-visual" data-node-id="3149:118">
              <div className="home-sos-ring home-sos-ring--outer" />
              <div className="home-sos-ring home-sos-ring--middle" />
              <button
                type="button"
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                onTouchCancel={cancelHold}
                onBlur={cancelHold}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault();
                    startHold();
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') cancelHold();
                }}
                className={`home-sos-button ${
                  sosState === 'holding' ? 'home-sos-button--holding' : ''
                }`}
                aria-label="Экстренный вызов SOS — удерживайте 3 секунды"
                data-node-id="3149:121"
              >
                <span className="home-sos-button__title" data-node-id="3149:115">
                  SOS
                </span>
                <span className="home-sos-button__hint" data-node-id="3149:116">
                  {sosState === 'holding'
                    ? `удерживайте... ${Math.ceil((300 - holdProgress * 3) / 100)} с`
                    : 'удерживайте 3 с'}
                </span>
              </button>
            </div>

            {/* Мобильная подпись под кнопкой SOS */}
            <div className="home-sos-mobile-copy">
              <p className="home-sos-mobile-copy__title" data-node-id="3149:2374">
                Нажмите и удерживайте 3 секунды
              </p>
              <p className="home-sos-mobile-copy__subtitle" data-node-id="3149:2375">
                Сообщение с координатами получат ваши контакты ({activeSosContacts.length}). В 112
                сигнал не передаётся
              </p>
              <div className="home-sos-mobile-actions">
                <button
                  type="button"
                  onClick={() => onNavigate?.('contacts')}
                  className="home-sos-mobile-contacts-btn"
                >
                  <Users size={16} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                  <span>Настроить контакты</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('report')}
                  className="home-sos-mobile-contacts-btn"
                >
                  <TriangleAlert size={16} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                  <span>Сообщить о ЧП</span>
                </button>
              </div>
            </div>

            {/* Десктопное описание справа от кнопки SOS */}
            <div className="home-sos-details" data-node-id="3149:146">
              <div className="home-sos-badge" data-node-id="3149:123">
                <span>{geoStatus}</span>
              </div>

              <h2 className="home-sos-details__title" data-node-id="3149:124">
                Экстренный вызов
              </h2>

              <p className="home-sos-details__desc" data-node-id="3149:125">
                Нажмите и удерживайте кнопку 3 секунды. Сообщение с координатами получат ваши
                экстренные контакты. В службу 112 сигнал не передаётся — позвоните туда сами.
              </p>

              <div className="home-sos-check" data-node-id="3149:131">
                <div className="home-sos-check__icon" data-node-id="3149:129">
                  <Check size={14} color="#008F82" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <span className="home-sos-check__text" data-node-id="3149:130">
                  Координаты: {user.address}
                  {accuracyText}
                </span>
              </div>

              <div className="home-sos-check" data-node-id="3149:137">
                <div className="home-sos-check__icon" data-node-id="3149:135">
                  <Check size={14} color="#008F82" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <span className="home-sos-check__text" data-node-id="3149:136">
                  Получат: {activeRecipientsLabel}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onNavigate?.('contacts')}
                className="home-sos-contacts-btn"
                data-node-id="3149:145"
              >
                <Users size={18} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                <span>Настроить контакты</span>
              </button>
            </div>
          </section>

          {/* Карточка: Экстренные службы (Десктоп) */}
          <section className="home-services-card" data-node-id="3149:199">
            <div className="home-section-header" data-node-id="3149:150">
              <h2 className="home-section-header__title" data-node-id="3149:149">
                Экстренные службы
              </h2>
              <button
                type="button"
                onClick={() => onNavigate?.('guides')}
                className="home-section-header__link"
                data-node-id="3149:148"
              >
                Все
              </button>
            </div>

            <div className="home-services-list">
              {services.map((service) => {
                const IconComponent = SERVICE_ICONS[service.icon] || Siren;
                return (
                  <a key={service.id} href={`tel:${service.number}`} className="home-service-row">
                    <div
                      className="home-service-row__icon"
                      style={{ backgroundColor: service.bgColor }}
                    >
                      <IconComponent
                        size={18}
                        color={service.iconColor}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="home-service-row__name">{service.name}</span>
                    <span className="home-service-row__number">{service.number}</span>
                  </a>
                );
              })}
            </div>
          </section>
        </div>

        {/* Мобильная секция: Экстренные службы (плитками 4 в ряд) */}
        <section className="home-mobile-services">
          <div className="home-section-header" data-node-id="3149:2416">
            <h2 className="home-section-header__title">Экстренные службы</h2>
            <button
              type="button"
              onClick={() => onNavigate?.('guides')}
              className="home-section-header__link"
            >
              Все
            </button>
          </div>
          <div className="home-mobile-services__grid" data-node-id="3149:2413">
            {mobileServices.map((service) => {
              const IconComponent = SERVICE_ICONS[service.icon] || Siren;
              return (
                <a
                  key={service.id}
                  href={`tel:${service.number}`}
                  className="home-mobile-service-tile"
                >
                  <div
                    className="home-mobile-service-tile__icon"
                    style={{ backgroundColor: service.bgColor }}
                  >
                    <IconComponent
                      size={20}
                      color={service.iconColor}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="home-mobile-service-tile__number">{service.number}</span>
                  <span className="home-mobile-service-tile__label">{service.shortName}</span>
                </a>
              );
            })}
          </div>
        </section>

        {/* Мобильная секция: Последнее оповещение */}
        {latestAlert && (
          <section className="home-mobile-alert">
            <div className="home-section-header" data-node-id="3149:2419">
              <h2 className="home-section-header__title">Последнее оповещение</h2>
              <button
                type="button"
                onClick={() => onNavigate?.('alerts')}
                className="home-section-header__link"
              >
                Лента
              </button>
            </div>
            <div
              className="home-mobile-alert__card"
              onClick={() => onNavigate?.('alerts')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onNavigate?.('alerts');
              }}
              data-node-id="3149:2426"
            >
              <div className="home-mobile-alert__head">
                <span className="home-mobile-alert__badge">{latestAlert.badgeText}</span>
                <span className="home-mobile-alert__time">{latestAlert.timeAgo}</span>
              </div>
              <h3 className="home-mobile-alert__title">{latestAlert.title}</h3>
              <p className="home-mobile-alert__subtitle">{latestAlert.subtitle}</p>
            </div>
          </section>
        )}

        {/* Мобильная секция: Экстренные контакты (быстрый переход с Главной) */}
        <section className="home-mobile-contacts">
          <div className="home-section-header">
            <h2 className="home-section-header__title">Экстренные контакты</h2>
            <button
              type="button"
              onClick={() => onNavigate?.('contacts')}
              className="home-section-header__link"
            >
              Изменить
            </button>
          </div>
          <div className="home-mobile-contacts__card">
            <div className="home-contacts-list">
              {homePreviewContacts.map((contact) => (
                <div key={contact.id} className="home-contact-row">
                  <div
                    className="home-contact-row__avatar"
                    style={{ backgroundColor: contact.avatarBg }}
                  >
                    <span>{contact.initials}</span>
                  </div>
                  <div className="home-contact-row__info">
                    <span className="home-contact-row__name">{contact.name}</span>
                    <span className="home-contact-row__sub">
                      {contact.relation} · {contact.phone}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('contacts')}
              className="home-contacts-add-btn"
            >
              <Plus size={18} color="#007DA5" strokeWidth={2.2} aria-hidden="true" />
              <span>Управление контактами</span>
            </button>
          </div>
        </section>

        {/* Второй ряд (Десктоп): Последние оповещения + Экстренные контакты */}
        <div className="home-row home-row--second" data-node-id="3149:291">
          {/* Последние оповещения */}
          <section className="home-alerts-card" data-node-id="3149:242">
            <div
              className="home-section-header home-section-header--alerts"
              data-node-id="3149:202"
            >
              <h2 className="home-section-header__title" data-node-id="3149:201">
                Последние оповещения
              </h2>
              <button
                type="button"
                onClick={() => onNavigate?.('alerts')}
                className="home-section-header__link"
                data-node-id="3149:200"
              >
                Все оповещения
              </button>
            </div>

            <div className="home-alerts-list">
              {alerts
                .filter((a) => a.showOnHomeDesktop !== false)
                .map((alert) => {
                  const IconComponent = ALERT_ICONS[alert.icon] || Bell;
                  return (
                    <div
                      key={alert.id}
                      className="home-alert-row"
                      onClick={() => onNavigate?.('alerts')}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        className="home-alert-row__icon"
                        style={{ backgroundColor: alert.bgColor }}
                      >
                        <IconComponent
                          size={20}
                          color={alert.accentColor}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="home-alert-row__content">
                        <span className="home-alert-row__title">{alert.title}</span>
                        <span className="home-alert-row__subtitle">{alert.subtitle}</span>
                      </div>
                      <div className="home-alert-row__meta">
                        <span
                          className="home-alert-row__badge"
                          style={{
                            backgroundColor: alert.bgColor,
                            color: alert.accentColor,
                          }}
                        >
                          {alert.badgeText}
                        </span>
                        <span className="home-alert-row__time">{alert.timeAgo}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          {/* Экстренные контакты */}
          <section className="home-contacts-card" data-node-id="3149:270">
            <div className="home-section-header" data-node-id="3149:245">
              <h2 className="home-section-header__title" data-node-id="3149:244">
                Экстренные контакты
              </h2>
              <button
                type="button"
                onClick={() => onNavigate?.('contacts')}
                className="home-section-header__link"
                data-node-id="3149:243"
              >
                Изменить
              </button>
            </div>

            <div className="home-contacts-list">
              {homePreviewContacts.map((contact) => (
                <div key={contact.id} className="home-contact-row">
                  <div
                    className="home-contact-row__avatar"
                    style={{ backgroundColor: contact.avatarBg }}
                  >
                    <span>{contact.initials}</span>
                  </div>
                  <div className="home-contact-row__info">
                    <span className="home-contact-row__name">{contact.name}</span>
                    <span className="home-contact-row__sub">
                      {contact.relation} · {contact.phone}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('contacts')}
              className="home-contacts-add-btn"
              data-node-id="3149:269"
            >
              <Plus size={18} color="#007DA5" strokeWidth={2.2} aria-hidden="true" />
              <span>Добавить контакт</span>
            </button>
          </section>
        </div>
      </main>

      {/* Нижняя панель навигации (Мобильная версия iPhone 16) */}
      <nav className="home-tabbar" aria-label="Мобильная навигация" data-node-id="3149:2444">
        <button
          type="button"
          onClick={() => onNavigate?.('home')}
          className="home-tabbar__item home-tabbar__item--active"
        >
          <Home size={24} strokeWidth={2} aria-hidden="true" />
          <span>Главная</span>
        </button>

        <button type="button" onClick={() => onNavigate?.('map')} className="home-tabbar__item">
          <Map size={24} strokeWidth={2} aria-hidden="true" />
          <span>Карта</span>
        </button>

        <div className="home-tabbar__sos-slot">
          <button
            type="button"
            onClick={() => onTriggerSos?.()}
            className="home-tabbar__sos-btn"
            data-node-id="3149:2471"
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
