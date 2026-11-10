import { useRef, useState } from 'react';
import {
  ShieldCheck,
  Home,
  Map,
  Bell,
  TriangleAlert,
  Users,
  BookOpen,
  Siren,
  Plus,
  MessageCircle,
  MoreVertical,
  Send,
  MapPin,
  ChevronLeft,
  Trash2,
  X,
  LayoutDashboard,
} from 'lucide-react';
import './ContactsPage.css';

export default function ContactsPage({
  user,
  contacts = [],
  maxContacts = 5,
  canModerate = false,
  onNavigate,
  onTriggerSos,
  onToggleContactSos,
  onAddContact,
  onDeleteContact,
}) {
  const dialogRef = useRef(null);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newReceivesSos, setNewReceivesSos] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const activeSosCount = contacts.filter((c) => c.receivesSos).length;
  const canAddMore = contacts.length < maxContacts;

  const openAddDialog = () => {
    if (!canAddMore) return;
    setNewName('');
    setNewRelation('');
    setNewPhone('');
    setNewReceivesSos(true);
    setAddError('');
    dialogRef.current?.showModal();
  };

  const closeAddDialog = () => {
    dialogRef.current?.close();
  };

  const handleDialogClick = (e) => {
    if (e.target === dialogRef.current) {
      dialogRef.current.close('dismiss');
    }
  };

  // Окно закрывается только после успеха; при ошибке введённое остаётся, ошибка видна в окне
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      await onAddContact?.({
        name: newName.trim(),
        relation: newRelation.trim() || 'Близкий',
        phone: newPhone.trim(),
        receivesSos: newReceivesSos,
      });
      closeAddDialog();
    } catch (error) {
      setAddError(error?.message || 'Не удалось добавить контакт');
    } finally {
      setAdding(false);
    }
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

  const handleNavClick = (id) => {
    onNavigate?.(id);
  };

  return (
    <div className="contacts-layout" data-node-id="3149:749" onClick={() => setOpenMenuId(null)}>
      {/* Боковое меню (Десктоп MacBook Pro 14") */}
      <aside className="sos-sidebar" data-node-id="3149:821">
        <div className="sos-sidebar__top" data-node-id="3149:801">
          <div className="sos-sidebar__logo" data-node-id="3149:759">
            <div className="sos-sidebar__logo-icon" data-node-id="3149:755">
              <ShieldCheck size={22} color="#003C54" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div className="sos-sidebar__logo-text" data-node-id="3149:758">
              <span className="sos-sidebar__brand" data-node-id="3149:756">
                Безопасный город
              </span>
              <span className="sos-sidebar__city" data-node-id="3149:757">
                {user?.city || 'Москва'}
              </span>
            </div>
          </div>

          <nav className="sos-sidebar__nav" aria-label="Основная навигация" data-node-id="3149:800">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === 'contacts';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
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

        <div className="sos-sidebar__bottom" data-node-id="3149:820">
          <button
            type="button"
            onClick={() => onTriggerSos?.()}
            className="sos-sidebar__sos-btn"
            data-node-id="3149:819"
          >
            <Siren size={20} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
            <span>Экстренный вызов SOS</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('register')}
            className="sos-sidebar__profile"
            data-node-id="3149:807"
          >
            <div className="sos-sidebar__avatar" data-node-id="3149:803">
              <span>{user?.initials || 'ПА'}</span>
            </div>
            <div className="sos-sidebar__profile-info" data-node-id="3149:806">
              <span className="sos-sidebar__profile-name" data-node-id="3149:804">
                {user?.mobileName || 'Полина Исупова'}
              </span>
              <span className="sos-sidebar__profile-phone" data-node-id="3149:805">
                {user?.displayPhone || '+7 912 345-67-89'}
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="contacts-main" data-node-id="3149:750">
        {/* DESKTOP TOPBAR */}
        <header className="contacts-topbar" data-node-id="3149:666">
          <div className="contacts-topbar__titles" data-node-id="3149:664">
            <h1 className="contacts-topbar__title" data-node-id="3149:662">
              Экстренные контакты
            </h1>
            <p className="contacts-topbar__subtitle" data-node-id="3149:663">
              {activeSosCount} из {maxContacts} контактов получают сигнал SOS
            </p>
          </div>

          <div className="contacts-topbar__actions" data-node-id="3149:665">
            <button
              type="button"
              className="contacts-add-btn-desktop"
              onClick={openAddDialog}
              disabled={!canAddMore}
              title={!canAddMore ? `Максимум ${maxContacts} контактов` : 'Добавить новый контакт'}
              data-node-id="3149:653"
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.2} aria-hidden="true" />
              <span>Добавить контакт</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('alerts')}
              className="contacts-topbar__bell"
              aria-label="Перейти к оповещениям"
              title="Оповещения"
              data-node-id="3149:658"
            >
              <Bell size={22} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
              <span className="contacts-topbar__bell-dot" aria-hidden="true" />
            </button>

            <button
              type="button"
              className="contacts-topbar__avatar"
              onClick={() => onNavigate?.('register')}
              title="Профиль пользователя"
              data-node-id="3149:661"
            >
              {user?.initials || 'ПА'}
            </button>
          </div>
        </header>

        {/* MOBILE TOPBAR */}
        <header className="contacts-mobile-header" data-node-id="3149:2631">
          <button
            type="button"
            className="contacts-mobile-back"
            onClick={() => onNavigate?.('home')}
            aria-label="Назад на главную"
            data-node-id="3149:2565"
          >
            <ChevronLeft size={22} color="#1D2A37" strokeWidth={2.2} aria-hidden="true" />
          </button>
          <h1 className="contacts-mobile-title" data-node-id="3149:2566">
            Контакты
          </h1>
        </header>

        {/* BODY */}
        <main className="contacts-body">
          {/* INFO BANNER */}
          <div className="contacts-info-banner" role="note" data-node-id="3149:671">
            <MessageCircle
              size={20}
              color="#008F82"
              strokeWidth={2}
              className="contacts-info-banner__icon"
              aria-hidden="true"
            />
            <p className="contacts-info-banner__text contacts-info-banner__text--desktop">
              Когда вы нажмёте SOS, эти люди получат SMS и push-уведомление с вашими координатами.
              Выключите переключатель, если человек не должен получать сигнал.
            </p>
            <p className="contacts-info-banner__text contacts-info-banner__text--mobile">
              Когда вы нажмёте SOS, эти люди получат SMS и push с вашими координатами
            </p>
          </div>

          {/* DESKTOP TABLE CARD */}
          <section
            className="contacts-table-card"
            aria-label="Таблица экстренных контактов"
            data-node-id="3149:715"
          >
            <div className="contacts-table-header" data-node-id="3149:682">
              <div className="contacts-col contacts-col--name">КОНТАКТ</div>
              <div className="contacts-col contacts-col--relation">КЕМ ПРИХОДИТСЯ</div>
              <div className="contacts-col contacts-col--phone">ТЕЛЕФОН</div>
              <div className="contacts-col contacts-col--toggle">ПОЛУЧАЕТ SOS</div>
              <div className="contacts-col contacts-col--actions" aria-hidden="true" />
            </div>

            {contacts.length === 0 && (
              <p className="contacts-empty">
                Пока никого нет. Добавьте близких — они получат сообщение, когда вы нажмёте SOS.
              </p>
            )}

            {contacts.map((contact) => {
              const avatarBg = contact.receivesSos ? contact.avatarBg || '#007DA5' : '#6B7A89';
              return (
                <div key={contact.id} className="contacts-table-row">
                  <div className="contacts-col contacts-col--name contacts-person">
                    <div className="contacts-person__avatar" style={{ backgroundColor: avatarBg }}>
                      {contact.initials}
                    </div>
                    <span className="contacts-person__name">{contact.name}</span>
                  </div>

                  <div className="contacts-col contacts-col--relation contacts-cell-text">
                    {contact.relation}
                  </div>

                  <div className="contacts-col contacts-col--phone contacts-cell-text">
                    {contact.phone}
                  </div>

                  <div className="contacts-col contacts-col--toggle">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(contact.receivesSos)}
                      aria-label={`Отправлять SOS контакту ${contact.name}`}
                      className={`contacts-switch ${contact.receivesSos ? 'contacts-switch--on' : ''}`}
                      onClick={() => onToggleContactSos?.(contact.id, !contact.receivesSos)}
                    >
                      <span className="contacts-switch__thumb" />
                    </button>
                  </div>

                  <div
                    className="contacts-col contacts-col--actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="contacts-more-btn"
                      aria-label={`Действия для контакта ${contact.name}`}
                      onClick={() =>
                        setOpenMenuId((prev) => (prev === contact.id ? null : contact.id))
                      }
                    >
                      <MoreVertical size={20} color="#6B7A89" />
                    </button>

                    {openMenuId === contact.id && (
                      <div className="contacts-row-menu">
                        <button
                          type="button"
                          className="contacts-row-menu__delete"
                          onClick={() => {
                            setOpenMenuId(null);
                            onDeleteContact?.(contact.id);
                          }}
                        >
                          <Trash2 size={15} />
                          <span>Удалить контакт</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* MOBILE CONTACTS LIST CARD */}
          <section
            className="contacts-mobile-card"
            aria-label="Список экстренных контактов"
            data-node-id="3149:2612"
          >
            {contacts.length === 0 && (
              <p className="contacts-empty">Пока никого нет. Добавьте близких для SOS.</p>
            )}
            {contacts.map((contact, idx) => {
              const avatarBg = contact.receivesSos ? contact.avatarBg || '#007DA5' : '#6B7A89';
              return (
                <div
                  key={contact.id}
                  className={`contacts-mobile-row ${idx > 0 ? 'contacts-mobile-row--bordered' : ''}`}
                >
                  <div
                    className="contacts-mobile-row__avatar"
                    style={{ backgroundColor: avatarBg }}
                  >
                    {contact.initials}
                  </div>

                  <div className="contacts-mobile-row__info">
                    <span className="contacts-mobile-row__name">{contact.name}</span>
                    <span className="contacts-mobile-row__meta">
                      {contact.relation} · {contact.phone}
                    </span>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(contact.receivesSos)}
                    aria-label={`Отправлять SOS контакту ${contact.name}`}
                    className={`contacts-switch ${contact.receivesSos ? 'contacts-switch--on' : ''}`}
                    onClick={() => onToggleContactSos?.(contact.id, !contact.receivesSos)}
                  >
                    <span className="contacts-switch__thumb" />
                  </button>
                </div>
              );
            })}
          </section>

          {/* MOBILE ADD BUTTON & HINT */}
          <button
            type="button"
            className="contacts-add-btn-mobile"
            onClick={openAddDialog}
            disabled={!canAddMore}
            data-node-id="3149:2617"
          >
            <Plus size={20} color="#007DA5" strokeWidth={2.2} aria-hidden="true" />
            <span>Добавить контакт</span>
          </button>

          <p className="contacts-mobile-hint" data-node-id="3149:2618">
            Можно добавить до {maxContacts} контактов. Включите переключатель, чтобы контакт получал
            сигнал SOS
          </p>

          {/* DESKTOP: HOW IT WORKS */}
          <section className="contacts-how" aria-label="Как это работает" data-node-id="3149:717">
            <h2 className="contacts-how__title" data-node-id="3149:716">
              Как это работает
            </h2>
            <div className="contacts-how__grid" data-node-id="3149:748">
              <article className="contacts-how__card" data-node-id="3149:731">
                <div className="contacts-how__icon" data-node-id="3149:728">
                  <Siren size={24} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                </div>
                <h3 className="contacts-how__step-title" data-node-id="3149:729">
                  1. Вы нажимаете SOS
                </h3>
                <p className="contacts-how__step-desc" data-node-id="3149:730">
                  Удерживаете кнопку 3 секунды в приложении или на сайте
                </p>
              </article>

              <article className="contacts-how__card" data-node-id="3149:739">
                <div className="contacts-how__icon" data-node-id="3149:736">
                  <Send size={24} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                </div>
                <h3 className="contacts-how__step-title" data-node-id="3149:737">
                  2. Контакты получают сигнал
                </h3>
                <p className="contacts-how__step-desc" data-node-id="3149:738">
                  SMS и push со ссылкой на ваше местоположение
                </p>
              </article>

              <article className="contacts-how__card" data-node-id="3149:747">
                <div className="contacts-how__icon" data-node-id="3149:744">
                  <MapPin size={24} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                </div>
                <h3 className="contacts-how__step-title" data-node-id="3149:745">
                  3. Видят вас на карте
                </h3>
                <p className="contacts-how__step-desc" data-node-id="3149:746">
                  Координаты обновляются, пока включён экстренный режим
                </p>
              </article>
            </div>
          </section>
        </main>
      </div>

      {/* Нижняя панель навигации (Мобильная версия iPhone 16) */}
      <nav className="home-tabbar" aria-label="Мобильная навигация" data-node-id="3149:2647">
        <button type="button" onClick={() => onNavigate?.('home')} className="home-tabbar__item">
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
            data-node-id="3149:2674"
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

      {/* ADD CONTACT MODAL DIALOG */}
      <dialog
        ref={dialogRef}
        closedby="any"
        className="contacts-dialog"
        onClick={handleDialogClick}
      >
        <div className="contacts-dialog__content">
          <div className="contacts-dialog__header">
            <h2 className="contacts-dialog__title">Новый экстренный контакт</h2>
            <button
              type="button"
              className="contacts-dialog__close"
              onClick={closeAddDialog}
              aria-label="Закрыть окно"
            >
              <X size={20} color="#6B7A89" />
            </button>
          </div>

          <form className="contacts-dialog__form" onSubmit={handleAddSubmit}>
            <div className="contacts-dialog__field">
              <label htmlFor="contact-name" className="contacts-dialog__label">
                Имя и Фамилия
              </label>
              <input
                id="contact-name"
                type="text"
                required
                placeholder="Введите имя и фамилию контакта"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="contacts-dialog__input"
              />
            </div>

            <div className="contacts-dialog__field">
              <label htmlFor="contact-relation" className="contacts-dialog__label">
                Кем приходится
              </label>
              <input
                id="contact-relation"
                type="text"
                placeholder="Мама, Папа, Муж, Подруга, Брат..."
                value={newRelation}
                onChange={(e) => setNewRelation(e.target.value)}
                className="contacts-dialog__input"
              />
            </div>

            <div className="contacts-dialog__field">
              <label htmlFor="contact-phone" className="contacts-dialog__label">
                Номер телефона
              </label>
              <input
                id="contact-phone"
                type="tel"
                inputMode="tel"
                required
                placeholder="+7 900 000-00-00"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="contacts-dialog__input"
              />
            </div>

            <label className="contacts-dialog__checkbox-row">
              <input
                type="checkbox"
                checked={newReceivesSos}
                onChange={(e) => setNewReceivesSos(e.target.checked)}
              />
              <span>Отправлять сигнал SOS этому контакту</span>
            </label>

            {addError && (
              <p className="contacts-dialog__error" role="alert">
                {addError}
              </p>
            )}

            <div className="contacts-dialog__actions">
              <button type="button" className="contacts-dialog__cancel" onClick={closeAddDialog}>
                Отмена
              </button>
              <button type="submit" disabled={adding} className="contacts-dialog__submit">
                {adding ? 'Сохраняем...' : 'Сохранить контакт'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}
