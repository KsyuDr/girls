import { useState } from 'react';
import {
  Bell,
  TriangleAlert,
  Siren,
  Search,
  Phone,
  Flame,
  Shield,
  HeartPulse,
  Zap,
  Car,
  CloudRain,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  X,
} from 'lucide-react';
import { AppSidebar, AccountMenu, MobileTabbar } from '../components/AppShell';
import './GuidesPage.css';

const ICON_MAP = {
  siren: Siren,
  flame: Flame,
  shield: Shield,
  'heart-pulse': HeartPulse,
  zap: Zap,
  car: Car,
  'cloud-rain': CloudRain,
  'triangle-alert': TriangleAlert,
};

export default function GuidesPage({
  services = [],
  guides = [],
  initialMobileDetailOpen = false,
  onNavigate,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuideId, setSelectedGuideId] = useState(guides[0]?.id || 'fire');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(initialMobileDetailOpen);
  const [showAllMobileGuides, setShowAllMobileGuides] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState([]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredServices = normalizedQuery
    ? services.filter(
        (s) =>
          s.name.toLowerCase().includes(normalizedQuery) ||
          s.description?.toLowerCase().includes(normalizedQuery) ||
          s.number.includes(normalizedQuery)
      )
    : services;

  const filteredGuides = normalizedQuery
    ? guides.filter(
        (g) =>
          g.title.toLowerCase().includes(normalizedQuery) ||
          g.detailTitle.toLowerCase().includes(normalizedQuery) ||
          g.steps.some((step) => step.toLowerCase().includes(normalizedQuery))
      )
    : guides;

  const selectedGuide =
    guides.find((g) => g.id === selectedGuideId) || filteredGuides[0] || guides[0];

  const isBookmarked = selectedGuide && bookmarkedIds.includes(selectedGuide.id);

  const toggleBookmark = (guideId) => {
    setBookmarkedIds((prev) =>
      prev.includes(guideId) ? prev.filter((id) => id !== guideId) : [...prev, guideId]
    );
  };

  const handleSelectGuide = (guideId, openMobileDetail = false) => {
    setSelectedGuideId(guideId);
    if (openMobileDetail) {
      setMobileDetailOpen(true);
    }
  };

  const SelectedGuideIcon = ICON_MAP[selectedGuide?.icon] || Flame;

  // На мобильном по умолчанию в макете 05 показаны первые 4 службы (112, 101, 102, 103), при поиске — все совпавшие
  const mobileServicesList = normalizedQuery ? filteredServices : filteredServices.slice(0, 4);

  const mobileGuidesList =
    normalizedQuery || showAllMobileGuides
      ? filteredGuides
      : filteredGuides.filter((g) => g.showOnMobilePreview !== false);

  return (
    <div className="guides-layout" data-node-id="3149:1061">
      <AppSidebar />

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <div className="guides-main page-enter" data-node-id="3149:1062">
        {/* ШАПКА ДЕСКТОПА */}
        <header className="guides-topbar" data-node-id="3149:1059">
          <div className="guides-topbar__titles" data-node-id="3149:1043">
            <h1 className="guides-topbar__title" data-node-id="3149:1041">
              Номера служб и памятки
            </h1>
            <p className="guides-topbar__subtitle" data-node-id="3149:1042">
              Звонок с компьютера откроется на связанном телефоне
            </p>
          </div>

          <div className="guides-topbar__actions" data-node-id="3149:1058">
            <search className="guides-topbar__search" data-node-id="3149:1049">
              <Search size={18} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по сайту"
                aria-label="Поиск по службам и памяткам"
                className="guides-topbar__search-input"
              />
            </search>

            <button
              type="button"
              onClick={() => onNavigate?.('alerts')}
              className="guides-topbar__bell"
              aria-label="Уведомления"
              data-node-id="3149:1054"
            >
              <Bell size={22} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
              <span className="guides-topbar__bell-dot" aria-hidden="true" />
            </button>

            <AccountMenu className="guides-topbar__avatar" />
          </div>
        </header>

        {/* ДЕСКТОП: РЯД КАРТОЧЕК ЭКСТРЕННЫХ СЛУЖБ (112, 101, 102, 103, 104) */}
        <section
          className="guides-services-row"
          aria-label="Номера экстренных служб"
          data-node-id="3149:900"
        >
          {filteredServices.map((service) => {
            const IconComponent = ICON_MAP[service.icon] || Siren;
            return (
              <article key={service.id} className="guides-service-card">
                <div
                  className="guides-service-card__icon"
                  style={{ backgroundColor: service.bgColor }}
                >
                  <IconComponent
                    size={24}
                    color={service.iconColor}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>

                <div className="guides-service-card__number">{service.number}</div>

                <div className="guides-service-card__info">
                  <h2 className="guides-service-card__name">{service.name}</h2>
                  <p className="guides-service-card__desc">{service.description}</p>
                </div>

                <a href={`tel:${service.number}`} className="guides-service-card__call-btn">
                  <Phone size={18} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                  <span>Позвонить</span>
                </a>
              </article>
            );
          })}
        </section>

        {/* ДЕСКТОП: ПАМЯТКИ (СПИСОК СЛЕВА + ДЕТАЛЬНАЯ ИНСТРУКЦИЯ СПРАВА) */}
        <div className="guides-content-row" data-node-id="3149:1060">
          {/* Левая колонка: список памяток */}
          <aside className="guides-list-card" aria-label="Список памяток" data-node-id="3149:979">
            <div className="guides-list-card__header" data-node-id="3149:903">
              <h2 className="guides-list-card__title" data-node-id="3149:902">
                Памятки
              </h2>
              <span className="guides-list-card__count" data-node-id="3149:901">
                {filteredGuides.length}
              </span>
            </div>

            <div className="guides-list-card__items">
              {filteredGuides.map((guide) => {
                const GuideIcon = ICON_MAP[guide.icon] || Flame;
                const isSelected = selectedGuide?.id === guide.id;
                return (
                  <button
                    key={guide.id}
                    type="button"
                    onClick={() => handleSelectGuide(guide.id, false)}
                    className={`guides-list-item ${isSelected ? 'guides-list-item--active' : ''}`}
                  >
                    <div
                      className={`guides-list-item__icon ${
                        isSelected ? 'guides-list-item__icon--active' : ''
                      }`}
                    >
                      <GuideIcon
                        size={20}
                        color={isSelected ? '#007DA5' : '#ED0536'}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="guides-list-item__text">
                      <span className="guides-list-item__name">{guide.title}</span>
                      <span className="guides-list-item__steps">{guide.stepsCountLabel}</span>
                    </div>

                    <ChevronRight
                      size={18}
                      color={isSelected ? '#007DA5' : '#6B7A89'}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Правая колонка: выбранная памятка */}
          {selectedGuide && (
            <article className="guides-detail-card" data-node-id="3149:1040">
              <div className="guides-detail-card__header" data-node-id="3149:996">
                <div className="guides-detail-card__hero-icon" data-node-id="3149:983">
                  <SelectedGuideIcon size={28} color="#ED0536" strokeWidth={2} aria-hidden="true" />
                </div>

                <div className="guides-detail-card__titles" data-node-id="3149:986">
                  <h2 className="guides-detail-card__title" data-node-id="3149:984">
                    {selectedGuide.detailTitle}
                  </h2>
                  <p className="guides-detail-card__meta" data-node-id="3149:985">
                    {selectedGuide.metaSubtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleBookmark(selectedGuide.id)}
                  className={`guides-detail-card__bookmark ${
                    isBookmarked ? 'guides-detail-card__bookmark--active' : ''
                  }`}
                  aria-label="Сохранить памятку в закладки"
                  aria-pressed={isBookmarked}
                  data-node-id="3149:990"
                >
                  <Bookmark
                    size={22}
                    color={isBookmarked ? '#007DA5' : '#1D2A37'}
                    fill={isBookmarked ? '#007DA5' : 'none'}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>

                <a
                  href={`tel:${selectedGuide.emergencyNumber}`}
                  className="guides-detail-card__call-btn"
                  data-node-id="3149:995"
                >
                  <Phone size={18} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
                  <span>Позвонить {selectedGuide.emergencyNumber}</span>
                </a>
              </div>

              <div className="guides-detail-card__body" data-node-id="3149:1039">
                <div className="guides-detail-card__steps" data-node-id="3149:1018">
                  <h3 className="guides-detail-card__section-title" data-node-id="3149:997">
                    Что делать
                  </h3>

                  {selectedGuide.steps.map((stepText, index) => (
                    <div key={index} className="guides-step-row">
                      <div className="guides-step-row__num">{index + 1}</div>
                      <p className="guides-step-row__text">{stepText}</p>
                    </div>
                  ))}
                </div>

                <div className="guides-detail-card__donts" data-node-id="3149:1038">
                  <h3 className="guides-detail-card__donts-title" data-node-id="3149:1019">
                    Чего делать нельзя
                  </h3>

                  {selectedGuide.donts.map((dontText, index) => (
                    <div key={index} className="guides-dont-row">
                      <X
                        size={18}
                        color="#ED0536"
                        strokeWidth={2.2}
                        className="guides-dont-row__icon"
                        aria-hidden="true"
                      />
                      <p className="guides-dont-row__text">{dontText}</p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          )}
        </div>

        {/* ====================================================================
            МОБИЛЬНАЯ ВЕРСИЯ (iPhone 16):
            1) Обзор «05 Службы и памятки» (3149:2782)
            2) Детальный экран «06 Памятка: пожар» (3149:2895)
           ==================================================================== */}
        {!mobileDetailOpen ? (
          <div className="guides-mobile-overview" data-node-id="3149:2782">
            <header className="guides-mobile-header" data-node-id="3149:2708">
              <h1 className="guides-mobile-title" data-node-id="3149:2707">
                Помощь
              </h1>
            </header>

            <search className="guides-mobile-search" data-node-id="3149:2715">
              <Search size={20} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по памяткам"
                aria-label="Поиск по памяткам"
                className="guides-mobile-search__input"
              />
            </search>

            <section className="guides-mobile-section">
              <div className="guides-mobile-section__head" data-node-id="3149:2717">
                <h2 className="guides-mobile-section__title" data-node-id="3149:2716">
                  Экстренные службы
                </h2>
              </div>

              <div className="guides-mobile-services-list" data-node-id="3149:2778">
                {mobileServicesList.map((service, idx) => {
                  const IconComponent = ICON_MAP[service.icon] || Siren;
                  return (
                    <div
                      key={service.id}
                      className={`guides-mobile-service-row ${
                        idx > 0 ? 'guides-mobile-service-row--bordered' : ''
                      }`}
                    >
                      <div
                        className="guides-mobile-service-row__icon"
                        style={{ backgroundColor: service.bgColor }}
                      >
                        <IconComponent
                          size={20}
                          color={service.iconColor}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </div>

                      <div className="guides-mobile-service-row__info">
                        <span className="guides-mobile-service-row__name">{service.name}</span>
                        <span className="guides-mobile-service-row__desc">
                          {service.description}
                        </span>
                      </div>

                      <span className="guides-mobile-service-row__number">{service.number}</span>

                      <a
                        href={`tel:${service.number}`}
                        className="guides-mobile-service-row__call"
                        aria-label={`Позвонить в ${service.name} (${service.number})`}
                      >
                        <Phone size={18} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="guides-mobile-section">
              <div className="guides-mobile-section__head" data-node-id="3149:2781">
                <h2 className="guides-mobile-section__title" data-node-id="3149:2780">
                  Памятки
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAllMobileGuides((prev) => !prev)}
                  className="guides-mobile-section__link"
                  data-node-id="3149:2779"
                >
                  {showAllMobileGuides ? 'Свернуть' : 'Все'}
                </button>
              </div>

              <div
                className={`guides-mobile-cards ${
                  showAllMobileGuides ? 'guides-mobile-cards--grid' : ''
                }`}
                data-node-id="3149:2706"
              >
                {mobileGuidesList.map((guide) => {
                  const GuideIcon = ICON_MAP[guide.icon] || Flame;
                  return (
                    <button
                      key={guide.id}
                      type="button"
                      onClick={() => handleSelectGuide(guide.id, true)}
                      className="guides-mobile-card"
                    >
                      <div className="guides-mobile-card__icon">
                        <GuideIcon size={20} color="#ED0536" strokeWidth={2} aria-hidden="true" />
                      </div>
                      <div className="guides-mobile-card__text">
                        <span className="guides-mobile-card__title">{guide.title}</span>
                        <span className="guides-mobile-card__steps">{guide.stepsCountLabel}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          /* МОБИЛЬНЫЙ ДЕТАЛЬНЫЙ ЭКРАН ПАМЯТКИ (06 Памятка: пожар · 3149:2895) */
          selectedGuide && (
            <div className="guides-mobile-detail" data-node-id="3149:2895">
              <header className="guides-mobile-detail__header" data-node-id="3149:2850">
                <button
                  type="button"
                  onClick={() => setMobileDetailOpen(false)}
                  className="guides-mobile-detail__back"
                  aria-label="Назад к списку памяток"
                  data-node-id="3149:2848"
                >
                  <ChevronLeft size={22} color="#1D2A37" strokeWidth={2.2} aria-hidden="true" />
                </button>

                <h1 className="guides-mobile-detail__title" data-node-id="3149:2849">
                  {selectedGuide.detailTitle}
                </h1>

                <button
                  type="button"
                  onClick={() => toggleBookmark(selectedGuide.id)}
                  className="guides-mobile-detail__bookmark"
                  aria-label="Сохранить памятку"
                  aria-pressed={isBookmarked}
                  data-node-id="3149:2844"
                >
                  <Bookmark
                    size={22}
                    color={isBookmarked ? '#007DA5' : '#1D2A37'}
                    fill={isBookmarked ? '#007DA5' : 'none'}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </header>

              {/* Красный баннер вызова службы */}
              <div className="guides-mobile-call-banner" data-node-id="3149:2840">
                <div className="guides-mobile-call-banner__icon" data-node-id="3149:2831">
                  <SelectedGuideIcon size={24} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
                </div>

                <div className="guides-mobile-call-banner__info" data-node-id="3149:2834">
                  <span className="guides-mobile-call-banner__title" data-node-id="3149:2832">
                    {selectedGuide.callBannerTitle}
                  </span>
                  <span className="guides-mobile-call-banner__sub" data-node-id="3149:2833">
                    {selectedGuide.callBannerSubtitle}
                  </span>
                </div>

                <a
                  href={`tel:${selectedGuide.emergencyNumber}`}
                  className="guides-mobile-call-banner__btn"
                  data-node-id="3149:2839"
                >
                  <Phone size={18} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
                  <span>{selectedGuide.emergencyNumber}</span>
                </a>
              </div>

              {/* Секция: Что делать */}
              <section className="guides-mobile-detail__section">
                <h2 className="guides-mobile-detail__section-title" data-node-id="3149:2851">
                  Что делать
                </h2>

                <div className="guides-mobile-detail__card" data-node-id="3149:2873">
                  {selectedGuide.steps.map((stepText, index) => (
                    <div key={index} className="guides-step-row">
                      <div className="guides-step-row__num">{index + 1}</div>
                      <p className="guides-step-row__text">{stepText}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Секция: Чего делать нельзя */}
              <section className="guides-mobile-detail__section">
                <h2 className="guides-mobile-detail__section-title" data-node-id="3149:2874">
                  Чего делать нельзя
                </h2>

                <div className="guides-mobile-detail__card" data-node-id="3149:2894">
                  {selectedGuide.donts.map((dontText, index) => (
                    <div key={index} className="guides-dont-row">
                      <X
                        size={18}
                        color="#ED0536"
                        strokeWidth={2.2}
                        className="guides-dont-row__icon"
                        aria-hidden="true"
                      />
                      <p className="guides-dont-row__text">{dontText}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )
        )}
      </div>

      <MobileTabbar />
    </div>
  );
}
