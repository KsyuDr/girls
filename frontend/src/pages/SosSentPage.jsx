import { useState, useEffect } from 'react';
import { Bell, Siren, Search, Phone, Plus, Shield, MapPin, Check } from 'lucide-react';
import { AppSidebar, AccountMenu } from '../components/AppShell';
import './SosSentPage.css';

const DELIVERY_BADGES = {
  sending: { label: 'Отправляется', className: 'sos-badge--blue' },
  delivered: { label: 'Доставлено', className: 'sos-badge--gray' },
  failed: { label: 'Не доставлено', className: 'sos-badge--red' },
};

export default function SosSentPage({
  user,
  sosWaitingTips = [],
  sosSession,
  onCancelSos,
  onNavigate,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  // «Я в безопасности» сначала спрашивает подтверждение: близким сразу уходит отбой
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (sosSession?.startedAt) {
      return Math.max(0, Math.floor((Date.now() - sosSession.startedAt) / 1000));
    }
    return 0;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (sosSession?.startedAt) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - sosSession.startedAt) / 1000)));
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sosSession]);

  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');
  const formattedTimer = `${minutes}:${seconds}`;

  // Показываем тех, кому сигнал реально ушёл (из ответа сервера), а не текущий список контактов:
  // контакт могли выключить или удалить уже после отправки
  const recipients = sosSession?.notifiedContacts ?? [];
  const mobileSosContacts = recipients.slice(0, 2);
  const nobodyNotified = recipients.length === 0;
  // Место неизвестно: близкие получили сообщение без координат — так и пишем
  const locationKnown = sosSession?.hasLocation !== false;
  const notifiedDesktop = locationKnown
    ? 'Ваши близкие получили сообщение с вашим местоположением. Служба 112 о сигнале не знает — если нужна помощь, позвоните туда сами. Оставайтесь на месте, если это безопасно.'
    : 'Ваши близкие получили сообщение, но без местоположения: его не удалось определить. Позвоните им или в 112 и скажите, где вы. Служба 112 о сигнале не знает.';
  const notifiedMobile = locationKnown
    ? 'Близкие получили сообщение. Нужна служба — позвоните 112'
    : 'Близкие получили сообщение без места — скажите им, где вы';
  const address = sosSession?.address || user.address;
  const coordinates = sosSession?.coordinates || user.coordinates;
  const accuracy = sosSession?.accuracyMeters ?? user.accuracyMeters;
  const accuracyText = typeof accuracy === 'number' ? ` · точность ${accuracy} м` : '';

  // Экран закрывается только после подтверждения сервера; при ошибке сигнал остаётся активным
  const handleCancel = async () => {
    setConfirmingCancel(false);
    setCancelling(true);
    setCancelError('');
    try {
      await onCancelSos?.();
    } catch (error) {
      setCancelError(
        `${error?.message || 'Не удалось отменить SOS'}. Сигнал остаётся активным — попробуйте ещё раз.`
      );
      setCancelling(false);
    }
  };

  return (
    <div className="sos-page" data-node-id="3149:531">
      <AppSidebar />

      {/* Основная область (Десктоп + Мобильная версия) */}
      <main className="sos-main page-enter" data-node-id="3149:532">
        {/* Верхняя шапка (Десктоп) */}
        <header className="sos-topbar" data-node-id="3149:528">
          <div className="sos-topbar__title-group" data-node-id="3149:512">
            <h1 className="sos-topbar__title" data-node-id="3149:510">
              Экстренный вызов
            </h1>
            <p className="sos-topbar__subtitle" data-node-id="3149:511">
              Вы в экстренном режиме
            </p>
          </div>

          <div className="sos-topbar__actions" data-node-id="3149:527">
            <search className="sos-topbar__search" data-node-id="3149:518">
              <Search size={18} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по сайту"
                aria-label="Поиск по сайту"
                className="sos-topbar__search-input"
              />
            </search>

            <button
              type="button"
              onClick={() => onNavigate?.('alerts')}
              className="sos-topbar__bell-btn"
              aria-label="Перейти к оповещениям"
              title="Оповещения"
              data-node-id="3149:523"
            >
              <Bell size={22} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
              <span className="sos-topbar__bell-dot" data-node-id="3149:524" />
            </button>

            <AccountMenu className="sos-topbar__avatar" />
          </div>
        </header>

        {/* Мобильная верхняя строка: бейдж «Экстренный режим» + таймер */}
        <div className="sos-mobile-status" data-node-id="3149:2477">
          <div className="sos-mobile-status__pill" data-node-id="3149:2475">
            <span className="sos-mobile-status__dot" aria-hidden="true" />
            <span>Экстренный режим</span>
          </div>
          <span className="sos-mobile-status__timer" data-node-id="3149:2476">
            {formattedTimer}
          </span>
        </div>

        {/* Красный баннер SOS (Десктоп) / Hero-блок (Мобильный) */}
        <section className="sos-banner" data-node-id="3149:389">
          <div className="sos-banner__rings" data-node-id="3149:375">
            <div className="sos-banner__ring sos-banner__ring--outer" />
            <div className="sos-banner__ring sos-banner__ring--middle" />
            <div className="sos-banner__ring sos-banner__ring--inner">
              <Siren size={30} color="#ED0536" strokeWidth={2.2} aria-hidden="true" />
            </div>
          </div>

          <div className="sos-banner__text" data-node-id="3149:381">
            <h2 className="sos-banner__title-desktop" data-node-id="3149:379">
              {nobodyNotified ? 'Сигнал SOS создан' : 'Сигнал SOS отправлен'} · {formattedTimer}
            </h2>
            <h2 className="sos-banner__title-mobile" data-node-id="3149:2492">
              {nobodyNotified ? 'Сигнал SOS создан' : 'Сигнал SOS отправлен'}
            </h2>
            <p className="sos-banner__desc-desktop" data-node-id="3149:380">
              {nobodyNotified
                ? 'Сигнал никому не отправлен: у вас нет контактов для SOS. Позвоните 112 и добавьте контакты.'
                : notifiedDesktop}
            </p>
            <p className="sos-banner__desc-mobile" data-node-id="3149:2493">
              {nobodyNotified ? 'Сигнал никому не отправлен — позвоните 112' : notifiedMobile}
            </p>
          </div>

          <div className="sos-banner__actions">
            <a href="tel:112" className="sos-banner__call-btn" data-node-id="3149:386">
              <Phone size={20} color="#ED0536" strokeWidth={2} aria-hidden="true" />
              <span>Позвонить 112</span>
            </a>

            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              disabled={cancelling}
              className="sos-banner__safe-btn"
              data-node-id="3149:388"
            >
              <span>{cancelling ? 'Отменяем...' : 'Я в безопасности'}</span>
            </button>
          </div>
        </section>

        {cancelError && (
          <p className="sos-cancel-error" role="alert">
            {cancelError}
          </p>
        )}

        {/* Основная сетка: Карта местоположения + Кому отправлено + Пока ждёте помощь */}
        <div className="sos-grid" data-node-id="3149:530">
          {/* Карточка: Ваше местоположение */}
          <section className="sos-map-card" data-node-id="3149:446">
            <div className="sos-card-header" data-node-id="3149:393">
              <h3 className="sos-card-header__title" data-node-id="3149:392">
                Ваше местоположение
              </h3>
              <span
                className={`sos-badge ${nobodyNotified ? 'sos-badge--red' : 'sos-badge--teal'}`}
                data-node-id="3149:391"
              >
                <span className="sos-badge__desktop">
                  {nobodyNotified ? 'Никому не отправлено' : `Получили: ${recipients.length}`}
                </span>
                <span className="sos-badge__mobile">
                  {nobodyNotified ? 'Никому' : `Получили: ${recipients.length}`}
                </span>
              </span>
            </div>

            {/* Схематичная карта района с пинами служб и текущей геолокацией */}
            <div className="sos-map-canvas" data-node-id="3149:394">
              <div className="sos-map-blocks" aria-hidden="true">
                {Array.from({ length: 30 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`sos-map-block ${idx === 22 ? 'sos-map-block--park' : ''}`}
                  />
                ))}
              </div>
              <div className="sos-map-road sos-map-road--h" aria-hidden="true" />
              <div className="sos-map-road sos-map-road--v" aria-hidden="true" />
              <div className="sos-map-river" aria-hidden="true" />

              {/* Пин больницы (Десктоп) */}
              <div
                className="sos-map-pin sos-map-pin--hospital"
                title="Пункт медицинской помощи"
                data-node-id="3149:435"
              >
                <Plus size={18} color="#FFFFFF" strokeWidth={2.5} aria-hidden="true" />
              </div>

              {/* Пин полиции (Десктоп) */}
              <div
                className="sos-map-pin sos-map-pin--police"
                title="Отделение полиции"
                data-node-id="3149:439"
              >
                <Shield size={18} color="#FFFFFF" strokeWidth={2.2} aria-hidden="true" />
              </div>

              {/* Текущее местоположение пользователя */}
              <div className="sos-map-user-marker" data-node-id="3149:428">
                <div className="sos-map-user-marker__halo" />
                <div className="sos-map-user-marker__dot" />
              </div>
            </div>

            <div className="sos-map-footer" data-node-id="3149:445">
              <MapPin size={18} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
              <span className="sos-map-footer__desktop" data-node-id="3149:444">
                {address}, {user.city} · {coordinates}
                {accuracyText}
              </span>
              <span className="sos-map-footer__mobile" data-node-id="3149:2522">
                {address}
                {accuracyText}
              </span>
            </div>
          </section>

          {/* Правая колонка */}
          <div className="sos-side" data-node-id="3149:529">
            {/* Карточка: Кому отправлено */}
            <section className="sos-recipients-card" data-node-id="3149:489">
              <h3 className="sos-card-header__title" data-node-id="3149:447">
                Кому отправлено
              </h3>

              {nobodyNotified && (
                <div className="sos-no-recipients" role="alert">
                  <strong>Сигнал никому не отправлен</strong>
                  <span>
                    У вас нет контактов, которым отправляется SOS. Позвоните 112 или добавьте
                    контакты.
                  </span>
                  <button type="button" onClick={() => onNavigate?.('contacts')}>
                    Добавить контакты
                  </button>
                </div>
              )}

              {/* Десктопный список получателей */}
              <div className="sos-recipients-list sos-recipients-list--desktop">
                {recipients.map((contact) => {
                  const badge =
                    DELIVERY_BADGES[contact.sosDeliveryStatus] || DELIVERY_BADGES.sending;
                  return (
                    <div key={contact.id} className="sos-recipient-row">
                      <div
                        className="sos-recipient-row__avatar"
                        style={{ backgroundColor: contact.avatarBg }}
                      >
                        <span>{contact.initials}</span>
                      </div>
                      <div className="sos-recipient-row__info">
                        <span className="sos-recipient-row__name">{contact.name}</span>
                        <span className="sos-recipient-row__sub">
                          {contact.relation} · {contact.notifyMethod || 'SMS'}
                        </span>
                      </div>
                      <span className={`sos-badge ${badge.className}`}>{badge.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Мобильный компактный список получателей (как в макете iPhone 16) */}
              <div className="sos-recipients-list sos-recipients-list--mobile">
                {mobileSosContacts.map((contact) => {
                  const badge =
                    DELIVERY_BADGES[contact.sosDeliveryStatus] || DELIVERY_BADGES.sending;
                  return (
                    <div key={contact.id} className="sos-recipient-row">
                      <div
                        className="sos-recipient-row__avatar sos-recipient-row__avatar--sm"
                        style={{ backgroundColor: contact.avatarBg }}
                      >
                        <span>{contact.initials}</span>
                      </div>
                      <span className="sos-recipient-row__name sos-recipient-row__name--flex">
                        {contact.mobileShortLabel || contact.relation || contact.name}
                      </span>
                      <span className={`sos-badge ${badge.className}`}>{badge.label}</span>
                    </div>
                  );
                })}
                {recipients.length > mobileSosContacts.length && (
                  <span className="sos-recipient-row__sub">
                    и ещё {recipients.length - mobileSosContacts.length}
                  </span>
                )}
              </div>
            </section>

            {/* Карточка: Пока ждёте помощь (Десктоп) */}
            <section className="sos-tips-card" data-node-id="3149:509">
              <h3 className="sos-card-header__title" data-node-id="3149:490">
                Пока ждёте помощь
              </h3>
              <div className="sos-tips-list">
                {sosWaitingTips.map((tip, idx) => (
                  <div key={idx} className="sos-tip-row">
                    <div className="sos-tip-row__icon">
                      <Check size={14} color="#008F82" strokeWidth={2.5} aria-hidden="true" />
                    </div>
                    <span className="sos-tip-row__text">{tip}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Мобильные нижние кнопки действий */}
        <div className="sos-mobile-actions">
          <a href="tel:112" className="sos-mobile-actions__call-btn" data-node-id="3149:2558">
            <Phone size={20} color="#ED0536" strokeWidth={2} aria-hidden="true" />
            <span>Позвонить 112</span>
          </a>

          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            disabled={cancelling}
            className="sos-mobile-actions__cancel-btn"
            data-node-id="3149:2560"
          >
            <span>{cancelling ? 'Отменяем...' : 'Я в безопасности — отменить'}</span>
          </button>
        </div>
      </main>

      {confirmingCancel && (
        <div
          className="app-modal"
          role="presentation"
          onKeyDown={(e) => e.key === 'Escape' && setConfirmingCancel(false)}
        >
          <div
            className="app-modal__card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sos-cancel-title"
          >
            <h2 id="sos-cancel-title" className="app-modal__title">
              Отменить сигнал SOS?
            </h2>
            <p className="app-modal__text">
              {nobodyNotified
                ? 'Сигнал будет завершён.'
                : `Близким (${recipients.length}) сразу уйдёт сообщение, что вы в безопасности.`}
            </p>
            <div className="app-modal__actions">
              <button
                type="button"
                className="app-modal__btn"
                autoFocus
                onClick={() => setConfirmingCancel(false)}
              >
                Нет, сигнал нужен
              </button>
              <button
                type="button"
                className="app-modal__btn app-modal__btn--danger"
                onClick={handleCancel}
              >
                Да, я в безопасности
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
