import { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  Siren,
  LogOut,
  LogIn,
  Home,
  Map,
  Bell,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useShell, RESIDENT_NAV, MODERATOR_NAV } from './shellContext';
import './AppShell.css';

function isActive(itemId, currentPage) {
  return itemId === currentPage;
}

/** Выход — отдельной кнопкой и только после подтверждения: случайный клик не разлогинит. */
function LogoutConfirm({ onCancel, onConfirm, variant = 'dark' }) {
  const confirmRef = useRef(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);
  return (
    <div className={`shell-logout-confirm shell-logout-confirm--${variant}`} role="group">
      <span className="shell-logout-confirm__text">Выйти из аккаунта?</span>
      <div className="shell-logout-confirm__actions">
        <button
          ref={confirmRef}
          type="button"
          className="shell-logout-confirm__yes"
          onClick={onConfirm}
        >
          Выйти
        </button>
        <button type="button" className="shell-logout-confirm__no" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

function NavBadge({ value, danger }) {
  if (!value) return null;
  return (
    <span className={`shell-badge ${danger ? 'shell-badge--danger' : ''}`}>
      {value > 99 ? '99+' : value}
    </span>
  );
}

/** Боковое меню (десктоп и ноутбук). Одинаковое на всех страницах. */
export function AppSidebar() {
  const {
    user,
    isAuthenticated,
    canModerate,
    currentPage,
    moderation,
    onNavigate,
    onTriggerSos,
    onLogout,
  } = useShell();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const renderItem = (item) => {
    const Icon = item.icon;
    const active = isActive(item.id, currentPage);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavigate(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`shell-nav__item ${active ? 'shell-nav__item--active' : ''}`}
      >
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
        <span className="shell-nav__label">{item.label}</span>
        {item.badge && <NavBadge value={moderation?.[item.badge]} danger={item.danger} />}
      </button>
    );
  };

  return (
    <aside className="shell-sidebar" aria-label="Меню">
      <div className="shell-sidebar__top">
        <button
          type="button"
          className="shell-brand"
          onClick={() => onNavigate('home')}
          aria-label="Безопасный город — на главную"
        >
          <span className="shell-brand__icon" aria-hidden="true">
            <ShieldCheck size={22} color="#003C54" strokeWidth={2.2} />
          </span>
          <span className="shell-brand__text">
            <span className="shell-brand__name">Безопасный город</span>
            <span className="shell-brand__city">{user?.city || 'Москва'}</span>
          </span>
        </button>

        <nav className="shell-nav" aria-label="Основная навигация">
          {RESIDENT_NAV.map(renderItem)}
          {canModerate && (
            <>
              <span className="shell-nav__section">Модерация</span>
              {MODERATOR_NAV.map(renderItem)}
            </>
          )}
        </nav>
      </div>

      <div className="shell-sidebar__bottom">
        <button type="button" onClick={() => onTriggerSos()} className="shell-sos-btn">
          <Siren size={20} strokeWidth={2} aria-hidden="true" className="shell-sos-btn__icon" />
          <span>Экстренный вызов SOS</span>
        </button>

        {isAuthenticated ? (
          confirmingLogout ? (
            <LogoutConfirm
              onCancel={() => setConfirmingLogout(false)}
              onConfirm={() => {
                setConfirmingLogout(false);
                onLogout();
              }}
            />
          ) : (
            <div className="shell-profile">
              <div className="shell-profile__avatar" aria-hidden="true">
                {user?.initials || '?'}
              </div>
              <div className="shell-profile__info">
                <span className="shell-profile__name">{user?.mobileName || user?.name}</span>
                <span className="shell-profile__meta">
                  {canModerate ? 'Модератор' : user?.displayPhone}
                </span>
              </div>
              <button
                type="button"
                className="shell-profile__logout"
                onClick={() => setConfirmingLogout(true)}
                aria-label="Выйти из аккаунта"
                title="Выйти из аккаунта"
              >
                <LogOut size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          )
        ) : (
          <button type="button" className="shell-login-btn" onClick={() => onNavigate('register')}>
            <LogIn size={18} strokeWidth={2} aria-hidden="true" />
            <span>Войти или зарегистрироваться</span>
          </button>
        )}
      </div>
    </aside>
  );
}

/**
 * Аватар в шапке страницы: открывает меню профиля с кнопкой «Выйти».
 * className — стиль аватара конкретной страницы (размер и цвет из макета).
 */
export function AccountMenu({ className = '' }) {
  const { user, isAuthenticated, canModerate, onNavigate, onLogout } = useShell();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && rootRef.current?.contains(e.target)) return;
      setOpen(false);
      setConfirming(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => onNavigate('register')}
        className={className}
        title="Войти"
        aria-label="Войти"
      >
        <LogIn size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="shell-account" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={className}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Профиль"
        title="Профиль"
      >
        {user?.initials || '?'}
      </button>
      {open && (
        <div className="shell-account__popover" role="dialog" aria-label="Профиль">
          <div className="shell-account__head">
            <span className="shell-account__name">{user?.mobileName || user?.name}</span>
            <span className="shell-account__meta">{user?.displayPhone}</span>
            {canModerate && <span className="shell-account__role">Модератор</span>}
          </div>
          {confirming ? (
            <LogoutConfirm
              variant="light"
              onCancel={() => setConfirming(false)}
              onConfirm={() => {
                setOpen(false);
                onLogout();
              }}
            />
          ) : (
            <>
              <button
                type="button"
                className="shell-account__item"
                onClick={() => {
                  setOpen(false);
                  onNavigate('contacts');
                }}
              >
                <span>Экстренные контакты</span>
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="shell-account__item shell-account__item--danger"
                onClick={() => setConfirming(true)}
              >
                <span>Выйти из аккаунта</span>
                <LogOut size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Нижняя панель на телефоне и планшете. «Ещё» — все остальные разделы, профиль и выход. */
export function MobileTabbar() {
  const {
    user,
    isAuthenticated,
    canModerate,
    currentPage,
    moderation,
    onNavigate,
    onTriggerSos,
    onLogout,
  } = useShell();
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const primary = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'map', label: 'Карта', icon: Map },
  ];
  const secondary = [{ id: 'alerts', label: 'Лента', icon: Bell }];
  const primaryIds = ['home', 'map', 'alerts'];
  const moreItems = [
    ...RESIDENT_NAV.filter((i) => !primaryIds.includes(i.id)),
    ...(canModerate ? MODERATOR_NAV : []),
  ];
  const moreActive = moreItems.some((i) => i.id === currentPage);
  const moderationAttention = canModerate && moderation?.activeSos > 0;

  const go = (page) => {
    setMoreOpen(false);
    setConfirmingLogout(false);
    onNavigate(page);
  };

  const tab = (item) => {
    const Icon = item.icon;
    const active = isActive(item.id, currentPage);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => go(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`shell-tab ${active ? 'shell-tab--active' : ''}`}
      >
        <Icon size={22} strokeWidth={2} aria-hidden="true" />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className="shell-tabbar" aria-label="Мобильная навигация">
        {primary.map(tab)}
        <div className="shell-tabbar__sos-slot">
          <button
            type="button"
            onClick={() => onTriggerSos()}
            className="shell-tabbar__sos"
            aria-label="Экстренный вызов SOS"
          >
            <span className="shell-tabbar__sos-wave" aria-hidden="true" />
            <span className="shell-tabbar__sos-label">SOS</span>
          </button>
        </div>
        {secondary.map(tab)}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={`shell-tab ${moreActive ? 'shell-tab--active' : ''}`}
        >
          <span className="shell-tab__icon-wrap">
            <Menu size={22} strokeWidth={2} aria-hidden="true" />
            {moderationAttention && <span className="shell-tab__dot" aria-hidden="true" />}
          </span>
          <span>Ещё</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="shell-sheet" role="presentation" onClick={() => setMoreOpen(false)}>
          <div
            className="shell-sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Все разделы"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shell-sheet__head">
              <span className="shell-sheet__title">Разделы</span>
              <button
                type="button"
                className="shell-sheet__close"
                onClick={() => setMoreOpen(false)}
                aria-label="Закрыть"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="shell-sheet__list">
              {moreItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.id, currentPage);
                const firstModerator = canModerate && item.id === MODERATOR_NAV[0].id;
                return (
                  <div key={item.id}>
                    {firstModerator && index > 0 && (
                      <span className="shell-sheet__section">Модерация</span>
                    )}
                    <button
                      type="button"
                      onClick={() => go(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`shell-sheet__item ${active ? 'shell-sheet__item--active' : ''}`}
                    >
                      <Icon size={20} strokeWidth={2} aria-hidden="true" />
                      <span className="shell-sheet__label">{item.label}</span>
                      {item.badge && (
                        <NavBadge value={moderation?.[item.badge]} danger={item.danger} />
                      )}
                      <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="shell-sheet__profile">
              {isAuthenticated ? (
                confirmingLogout ? (
                  <LogoutConfirm
                    variant="light"
                    onCancel={() => setConfirmingLogout(false)}
                    onConfirm={() => {
                      setMoreOpen(false);
                      setConfirmingLogout(false);
                      onLogout();
                    }}
                  />
                ) : (
                  <>
                    <div className="shell-sheet__avatar" aria-hidden="true">
                      {user?.initials || '?'}
                    </div>
                    <div className="shell-sheet__who">
                      <span className="shell-sheet__name">{user?.mobileName || user?.name}</span>
                      <span className="shell-sheet__meta">
                        {canModerate ? `Модератор · ${user?.displayPhone}` : user?.displayPhone}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="shell-sheet__logout"
                      onClick={() => setConfirmingLogout(true)}
                    >
                      <LogOut size={18} strokeWidth={2} aria-hidden="true" />
                      <span>Выйти</span>
                    </button>
                  </>
                )
              ) : (
                <button type="button" className="shell-login-btn" onClick={() => go('register')}>
                  <LogIn size={18} strokeWidth={2} aria-hidden="true" />
                  <span>Войти или зарегистрироваться</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
