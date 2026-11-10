import { useState, useRef } from 'react';
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
  Flame,
  Car,
  CloudRain,
  Zap,
  MoreHorizontal,
  MapPin,
  Camera,
  Send,
  ChevronLeft,
  Check,
  X,
  LayoutDashboard,
} from 'lucide-react';
import './ReportPage.css';

const INCIDENT_ICONS = {
  flame: Flame,
  car: Car,
  users: Users,
  'cloud-rain': CloudRain,
  zap: Zap,
  'more-horizontal': MoreHorizontal,
};

export default function ReportPage({
  user,
  incidentTypes = [],
  reportNextSteps = [],
  onSubmitReport,
  onNavigate,
  onTriggerSos,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState(incidentTypes[1]?.id || 'accident');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedIncident, setSubmittedIncident] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPhotos = files.slice(0, 4 - photos.length).map((file, idx) => ({
      id: `ph_${Date.now()}_${idx}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 4));
    e.target.value = '';
  };

  const handleRemovePhoto = (photoId) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleFillGeolocation = () => {
    setAddress(user?.address || 'ул. Малышева, 51');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await onSubmitReport?.({
        typeId: selectedTypeId,
        address: address.trim() || user?.address || 'ул. Малышева, 51',
        description: description.trim(),
        anonymous,
        photosCount: photos.length,
      });
      setSubmittedIncident(result?.incident || { id: '#1049' });
      setDescription('');
      setPhotos([]);
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="report-layout" data-node-id="3149:1851">
      {/* Боковая панель (Десктоп MacBook Pro 14") */}
      <aside className="sos-sidebar" data-node-id="3149:1923">
        <div className="sos-sidebar__top" data-node-id="3149:1903">
          <div className="sos-sidebar__logo" data-node-id="3149:1861">
            <div className="sos-sidebar__logo-icon" data-node-id="3149:1857">
              <ShieldCheck size={22} color="#003C54" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div className="sos-sidebar__logo-text" data-node-id="3149:1860">
              <span className="sos-sidebar__brand" data-node-id="3149:1858">
                Безопасный город
              </span>
              <span className="sos-sidebar__city" data-node-id="3149:1859">
                {user?.city || 'Москва'}
              </span>
            </div>
          </div>

          <nav
            className="sos-sidebar__nav"
            aria-label="Основная навигация"
            data-node-id="3149:1902"
          >
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === 'report';
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

        <div className="sos-sidebar__bottom" data-node-id="3149:1922">
          <button
            type="button"
            onClick={() => onTriggerSos?.()}
            className="sos-sidebar__sos-btn"
            data-node-id="3149:1921"
          >
            <Siren size={20} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
            <span>Экстренный вызов SOS</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('register')}
            className="sos-sidebar__profile"
            data-node-id="3149:1909"
          >
            <div className="sos-sidebar__avatar" data-node-id="3149:1905">
              <span>{user?.initials || 'ПА'}</span>
            </div>
            <div className="sos-sidebar__profile-info" data-node-id="3149:1908">
              <span className="sos-sidebar__profile-name" data-node-id="3149:1906">
                {user?.mobileName || 'Полина Исупова'}
              </span>
              <span className="sos-sidebar__profile-phone" data-node-id="3149:1907">
                {user?.displayPhone || '+7 912 345-67-89'}
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* Основная область */}
      <div className="report-main" data-node-id="3149:1852">
        {/* Верхняя шапка (Десктоп) */}
        <header className="report-topbar" data-node-id="3149:1849">
          <div className="report-topbar__titles" data-node-id="3149:1833">
            <h1 className="report-topbar__title" data-node-id="3149:1831">
              Сообщить о происшествии
            </h1>
            <p className="report-topbar__subtitle" data-node-id="3149:1832">
              Сообщение получит диспетчер ЕДДС города
            </p>
          </div>

          <div className="report-topbar__actions" data-node-id="3149:1848">
            <search className="report-topbar__search" data-node-id="3149:1839">
              <Search size={18} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по сайту"
                aria-label="Поиск по сайту"
                className="report-topbar__search-input"
              />
            </search>

            <button
              type="button"
              onClick={() => onNavigate?.('alerts')}
              className="report-topbar__bell"
              aria-label="Перейти к оповещениям"
              title="Оповещения"
              data-node-id="3149:1844"
            >
              <Bell size={22} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
              <span className="report-topbar__bell-dot" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('register')}
              className="report-topbar__avatar"
              title="Профиль пользователя"
              data-node-id="3149:1847"
            >
              {user?.initials || 'ПА'}
            </button>
          </div>
        </header>

        {/* Мобильная шапка (iPhone 16 / 09 Сообщить о происшествии · 3149:3345) */}
        <header className="report-mobile-header" data-node-id="3149:3258">
          <button
            type="button"
            onClick={() => onNavigate?.('home')}
            className="report-mobile-back"
            aria-label="Назад на главную"
            data-node-id="3149:3256"
          >
            <ChevronLeft size={22} color="#1D2A37" strokeWidth={2.2} aria-hidden="true" />
          </button>
          <h1 className="report-mobile-title" data-node-id="3149:3257">
            Сообщить о происшествии
          </h1>
        </header>

        {/* Основная сетка: Форма слева + Информационные карточки справа */}
        <div className="report-content-row" data-node-id="3149:1850">
          {/* Карточка формы */}
          <form className="report-form-card" onSubmit={handleSubmit} data-node-id="3149:1792">
            {submittedIncident && (
              <div className="report-success-banner" role="status">
                <div className="report-success-banner__icon">
                  <Check size={18} color="#008F82" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <div className="report-success-banner__body">
                  <strong>Обращение {submittedIncident.id} передано диспетчеру ЕДДС</strong>
                  <span>Статус обновится в уведомлениях и в панели дежурных служб.</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate?.('operator')}
                  className="report-success-banner__link"
                >
                  Открыть панель служб
                </button>
              </div>
            )}

            <div className="report-section">
              <span className="report-section__label" data-node-id="3149:1690">
                Что случилось?
              </span>

              <div
                className="report-types-grid"
                role="radiogroup"
                aria-label="Тип происшествия"
                data-node-id="3149:1738"
              >
                {incidentTypes.map((type) => {
                  const IconComponent = INCIDENT_ICONS[type.icon] || Car;
                  const isActive = selectedTypeId === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setSelectedTypeId(type.id)}
                      className={`report-type-tile ${isActive ? 'report-type-tile--active' : ''}`}
                    >
                      <IconComponent
                        size={24}
                        color={isActive ? '#007DA5' : '#003C54'}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span>{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Поле: Где произошло */}
            <div className="report-field" data-node-id="3149:1749">
              <label
                htmlFor="report-address"
                className="report-field__label"
                data-node-id="3149:1739"
              >
                Где произошло
              </label>
              <div className="report-address-input-wrap" data-node-id="3149:1745">
                <MapPin size={20} color="#008F82" strokeWidth={2} aria-hidden="true" />
                <input
                  id="report-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Укажите адрес или ориентир"
                  className="report-address-input"
                />
              </div>
              <div className="report-address-hint" data-node-id="3149:1748">
                <button
                  type="button"
                  onClick={handleFillGeolocation}
                  className="report-address-hint__geo-btn"
                  data-node-id="3149:1746"
                >
                  Определено по геолокации ({user?.address || 'ул. Малышева, 51'})
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onNavigate?.('map')}
                  className="report-address-hint__map-link"
                  data-node-id="3149:1747"
                >
                  Изменить на карте
                </button>
              </div>
            </div>

            {/* Поле: Описание */}
            <div className="report-field" data-node-id="3149:1753">
              <label
                htmlFor="report-description"
                className="report-field__label"
                data-node-id="3149:1750"
              >
                Описание
              </label>
              <textarea
                id="report-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Опишите, что произошло, есть ли пострадавшие и какие службы нужны"
                className="report-textarea"
                data-node-id="3149:1752"
              />
            </div>

            {/* Фото или видео */}
            <div className="report-field" data-node-id="3149:1776">
              <span className="report-field__label" data-node-id="3149:1754">
                Фото или видео
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
                className="report-file-hidden"
                aria-label="Прикрепить фото или видео"
              />
              <div className="report-photos-row" data-node-id="3149:1775">
                {photos.map((photo) => (
                  <div key={photo.id} className="report-photo-slot report-photo-slot--filled">
                    <img src={photo.url} alt={photo.name} className="report-photo-slot__img" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="report-photo-slot__remove"
                      aria-label={`Удалить файл ${photo.name}`}
                    >
                      <X size={14} color="#FFFFFF" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}

                {photos.length === 0 && (
                  <>
                    <div
                      className="report-photo-slot"
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                      }}
                      aria-label="Слот для фото 1"
                      data-node-id="3149:1761"
                    >
                      <Camera size={22} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
                    </div>
                    <div
                      className="report-photo-slot"
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                      }}
                      aria-label="Слот для фото 2"
                      data-node-id="3149:1768"
                    >
                      <Camera size={22} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
                    </div>
                  </>
                )}

                {photos.length < 4 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="report-photo-add"
                    data-node-id="3149:1774"
                  >
                    <Camera size={22} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                    <span>Добавить</span>
                  </button>
                )}
              </div>
            </div>

            {/* Переключатель: Отправить анонимно */}
            <div className="report-anon-card" data-node-id="3149:1782">
              <div className="report-anon-card__info" data-node-id="3149:1779">
                <span className="report-anon-card__title" data-node-id="3149:1777">
                  Отправить анонимно
                </span>
                <span className="report-anon-card__subtitle" data-node-id="3149:1778">
                  Диспетчер не увидит ваше имя и телефон
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={anonymous}
                aria-label="Отправить анонимно"
                onClick={() => setAnonymous((prev) => !prev)}
                className={`report-switch ${anonymous ? 'report-switch--on' : ''}`}
                data-node-id="3149:1780"
              >
                <span className="report-switch__thumb" />
              </button>
            </div>

            {/* Кнопки отправки */}
            <div className="report-actions" data-node-id="3149:1791">
              <button
                type="submit"
                disabled={submitting}
                className="report-submit-btn"
                data-node-id="3149:1788"
              >
                <Send size={18} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
                <span>{submitting ? 'Отправка...' : 'Отправить сообщение'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate?.('home')}
                className="report-cancel-btn"
                data-node-id="3149:1790"
              >
                Отмена
              </button>
            </div>
          </form>

          {/* Правая колонка (Десктоп): «Что будет дальше» + «Угроза жизни?» */}
          <aside className="report-side-col" data-node-id="3149:1830">
            <section className="report-steps-card" data-node-id="3149:1812">
              <h2 className="report-steps-card__title" data-node-id="3149:1793">
                Что будет дальше
              </h2>
              <div className="report-steps-list">
                {reportNextSteps.map((step) => (
                  <div key={step.id} className="report-step-row">
                    <div className="report-step-row__num">{step.number}</div>
                    <div className="report-step-row__text">
                      <span className="report-step-row__title">{step.title}</span>
                      <span className="report-step-row__subtitle">{step.subtitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="report-danger-card" data-node-id="3149:1829">
              <div className="report-danger-card__head" data-node-id="3149:1821">
                <TriangleAlert size={22} color="#ED0536" strokeWidth={2.2} aria-hidden="true" />
                <h2 className="report-danger-card__title" data-node-id="3149:1820">
                  Угроза жизни?
                </h2>
              </div>
              <p className="report-danger-card__desc" data-node-id="3149:1822">
                Не заполняйте форму — звоните 112 или нажмите SOS. Так помощь придёт быстрее.
              </p>
              <div className="report-danger-card__actions" data-node-id="3149:1828">
                <button
                  type="button"
                  onClick={() => onTriggerSos?.()}
                  className="report-danger-card__sos-btn"
                  data-node-id="3149:1825"
                >
                  SOS
                </button>
                <a href="tel:112" className="report-danger-card__call-btn" data-node-id="3149:1827">
                  Позвонить 112
                </a>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* Нижняя панель навигации (Мобильная версия iPhone 16) */}
      <nav className="home-tabbar" aria-label="Мобильная навигация">
        <button type="button" onClick={() => onNavigate?.('home')} className="home-tabbar__item">
          <Home size={24} strokeWidth={2} aria-hidden="true" />
          <span>Главная</span>
        </button>

        <button type="button" onClick={() => onNavigate?.('map')} className="home-tabbar__item">
          <Map size={24} strokeWidth={2} aria-hidden="true" />
          <span>Карта</span>
        </button>

        <div className="home-tabbar__sos-slot">
          <button type="button" onClick={() => onTriggerSos?.()} className="home-tabbar__sos-btn">
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
