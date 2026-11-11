import { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  FileText,
  Map,
  Siren,
  Bell,
  LayoutDashboard,
  Plus,
  Clock,
  Zap,
  MapPin,
  Car,
  Flame,
  CloudRain,
  Users,
  Shield,
  MoreHorizontal,
  ArrowLeft,
  Check,
  X,
  Pencil,
  EyeOff,
  Eye,
} from 'lucide-react';
import { elapsedLabel, ALERT_LEVEL_CONFIG } from '../services/adapters';
import './OperatorPanelPage.css';

const INCIDENT_TYPE_ICONS = {
  car: { Icon: Car, color: '#007DA5' },
  flame: { Icon: Flame, color: '#ED0536' },
  'cloud-rain': { Icon: CloudRain, color: '#007DA5' },
  users: { Icon: Users, color: '#ED0536' },
  zap: { Icon: Zap, color: '#003C54' },
  'more-horizontal': { Icon: MoreHorizontal, color: '#6B7A89' },
};

const STATUS_BADGE_STYLES = {
  new: { bg: '#FDE7EC', color: '#ED0536', label: 'Новое' },
  in_progress: { bg: '#E5F2F7', color: '#007DA5', label: 'В работе' },
  closed: { bg: '#E0F7F4', color: '#008F82', label: 'Закрыто' },
  hidden: { bg: '#EDF1F5', color: '#6B7A89', label: 'Скрыто' },
};

const STATUS_OPTIONS = ['new', 'in_progress', 'closed', 'hidden'];

// Порядок переключения фильтра таблицы
const NEXT_FILTER = { all: 'new', new: 'in_progress', in_progress: 'hidden', hidden: 'all' };
const FILTER_LABELS = {
  all: 'Все обращения',
  new: 'Только новые (дальше)',
  in_progress: 'В работе (дальше)',
  hidden: 'Скрытые (сбросить)',
};

const ALERT_LEVEL_LABELS = {
  critical: 'Критическое',
  warning: 'Предупреждение',
  info: 'Информация',
};

/** Заметка модератора к метке: по клику — поле ввода, Enter или «Сохранить» — на сервер. */
function NoteCell({ incident, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(incident.moderatorNote || '');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (ok !== false) setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="operator-note-btn"
        onClick={start}
        title="Изменить заметку"
        aria-label={`Заметка к обращению ${incident.id}: ${incident.moderatorNote || 'нет'}`}
      >
        <span>{incident.moderatorNote || 'Добавить'}</span>
        <Pencil size={14} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
      </button>
    );
  }
  return (
    <form
      className="operator-note-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        type="text"
        value={draft}
        maxLength={1000}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        placeholder="Например: передано в управу"
        aria-label={`Заметка к обращению ${incident.id}`}
        className="operator-note-form__input"
      />
      <button type="submit" disabled={saving} className="operator-note-form__save">
        {saving ? '...' : 'Сохранить'}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="operator-note-form__cancel"
        aria-label="Отменить правку заметки"
      >
        <X size={14} color="#6B7A89" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </form>
  );
}

export default function OperatorPanelPage({
  operatorProfile,
  incidents = [],
  sosSignals = [],
  stats = null,
  alerts = [],
  onUpdateIncidentStatus,
  onResolveSos,
  onCreateAlert,
  onUpdateAlert,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState('incidents'); // 'incidents' | 'sos' | 'reports'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'new' | 'in_progress' | 'hidden'
  const [resolvingId, setResolvingId] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // «Сигнал N мин назад» и «за последний час» пересчитываем раз в полминуты
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Поля модального окна «Создать оповещение» (пустые по умолчанию, только с подсказками placeholder).
  // То же окно правит уже опубликованное оповещение (editingAlert)
  const alertDialogRef = useRef(null);
  const [editingAlert, setEditingAlert] = useState(null);
  const [alertSubtitle, setAlertSubtitle] = useState('');
  const [alertTogglingId, setAlertTogglingId] = useState(null);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertDescription, setAlertDescription] = useState('');
  const [alertLocation, setAlertLocation] = useState('');
  const [alertSource, setAlertSource] = useState('');
  const [alertLevel, setAlertLevel] = useState('warning');
  const [alertError, setAlertError] = useState('');
  const [alertSubmitting, setAlertSubmitting] = useState(false);

  const newCount = incidents.filter((inc) => inc.status === 'new').length;
  const inProgressCount = incidents.filter((inc) => inc.status === 'in_progress').length;

  // С бэкендом (есть stats) показываем настоящие числа с сервера. В режиме моков — как в макете:
  // 12 новых и 8 в работе, плюс динамика добавленных обращений
  const displayedNewCount = stats ? stats.newIncidents : Math.max(12, 10 + newCount);
  const displayedInProgressCount = stats ? stats.inProgress : Math.max(8, 6 + inProgressCount);
  const sosCount = stats ? stats.activeSos : sosSignals.length;
  const lastHourCount = incidents.filter(
    (inc) => inc.createdAt && now - Date.parse(inc.createdAt) < 60 * 60 * 1000
  ).length;
  const newFooter = stats ? `+${lastHourCount} за последний час` : '+4 за последний час';
  const inProgressFooter = stats ? `Всего обращений: ${incidents.length}` : '3 службы на выезде';
  const reactionLabel = stats
    ? stats.avgReactionMinutes === null
      ? '—'
      : `${Math.round(stats.avgReactionMinutes)} мин`
    : '4 мин';
  let reactionTrend = '−1 мин к вчерашнему дню';
  if (stats) {
    if (stats.avgReactionMinutes === null || stats.avgReactionMinutesPrev === null) {
      reactionTrend = 'Нет данных для сравнения со вчера';
    } else {
      const diff = Math.round(stats.avgReactionMinutes - stats.avgReactionMinutesPrev);
      reactionTrend = `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)} мин к вчерашнему дню`;
    }
  }

  const visibleIncidents =
    statusFilter === 'all' ? incidents : incidents.filter((inc) => inc.status === statusFilter);

  // Статус выбирается явно; «Скрыть», «Закрыть» и возврат скрытой метки — с подтверждением
  const handleStatusChange = (incident, nextStatus) => {
    if (nextStatus === incident.status) return;
    let question = '';
    if (nextStatus === 'hidden') {
      question = `Скрыть метку ${incident.id}? Она пропадёт с карты у всех жителей.`;
    } else if (incident.status === 'hidden') {
      question = `Вернуть метку ${incident.id} на карту? Её снова увидят все жители.`;
    } else if (nextStatus === 'closed') {
      question = `Закрыть обращение ${incident.id}? Отклики помощников будут отмечены выполненными.`;
    }
    if (question && !window.confirm(question)) return;
    onUpdateIncidentStatus?.(incident.id, nextStatus);
  };

  const handleResolve = async (sos) => {
    if (
      !window.confirm(`Отметить, что помощь пришла (${sos.userName})? Сигнал SOS будет закрыт.`)
    ) {
      return;
    }
    setResolvingId(sos.id);
    try {
      await onResolveSos?.(sos.id);
    } finally {
      setResolvingId(null);
    }
  };

  // «Критическое» по умолчанию не ставим: случайная публикация не должна пугать весь город
  const openAlertDialog = () => {
    setEditingAlert(null);
    setAlertTitle('');
    setAlertSubtitle('');
    setAlertDescription('');
    setAlertLocation('');
    setAlertSource('');
    setAlertLevel('warning');
    setAlertError('');
    alertDialogRef.current?.showModal();
  };

  const openEditAlertDialog = (alert) => {
    setEditingAlert(alert);
    setAlertTitle(alert.title);
    setAlertSubtitle(alert.rawSubtitle ?? '');
    setAlertDescription(alert.description);
    setAlertLocation(alert.locationLabel === 'Весь город' ? '' : alert.locationLabel || '');
    setAlertSource(alert.rawSourceLabel ?? '');
    setAlertLevel(alert.level || 'warning');
    setAlertError('');
    alertDialogRef.current?.showModal();
  };

  // Снять с публикации / вернуть — с подтверждением, как и скрытие метки
  const handleToggleAlertPublished = async (alert) => {
    const published = alert.isPublished !== false;
    const question = published
      ? `Снять оповещение «${alert.title}» с публикации? Жители перестанут его видеть.`
      : `Вернуть оповещение «${alert.title}» в ленту? Его снова увидят все жители.`;
    if (!window.confirm(question)) return;
    setAlertTogglingId(alert.id);
    try {
      await onUpdateAlert?.(
        alert.id,
        { isPublished: !published },
        published ? 'Оповещение снято с публикации' : 'Оповещение снова в ленте'
      );
    } catch (error) {
      window.alert(error?.message || 'Не удалось изменить оповещение');
    } finally {
      setAlertTogglingId(null);
    }
  };

  const closeAlertDialog = () => {
    alertDialogRef.current?.close();
  };

  const handleDialogBackdropClick = (e) => {
    if (e.target === alertDialogRef.current) {
      alertDialogRef.current.close('dismiss');
    }
  };

  const handleCreateAlertSubmit = async (e) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertDescription.trim()) return;
    setAlertSubmitting(true);
    setAlertError('');
    const fields = {
      title: alertTitle.trim(),
      subtitle: alertSubtitle.trim(),
      description: alertDescription.trim(),
      locationLabel: alertLocation.trim() || 'Весь город',
      sourceLabel: alertSource.trim(), // пусто — в ленте будет «Безопасный город»
      level: alertLevel,
    };
    try {
      if (editingAlert) {
        await onUpdateAlert?.(editingAlert.id, fields, 'Изменения сохранены');
      } else {
        await onCreateAlert?.(fields);
      }
      closeAlertDialog();
    } catch (error) {
      // окно остаётся открытым, введённый текст не теряется
      setAlertError(
        error?.message ||
          (editingAlert ? 'Не удалось сохранить изменения' : 'Не удалось опубликовать оповещение')
      );
    } finally {
      setAlertSubmitting(false);
    }
  };

  return (
    <div className="operator-layout" data-node-id="3149:2216">
      {/* Боковая панель модератора (Десктоп MacBook Pro 14" · 3149:2282) */}
      <aside className="operator-sidebar" data-node-id="3149:2282">
        <div className="operator-sidebar__top" data-node-id="3149:2274">
          <div className="operator-sidebar__logo" data-node-id="3149:2226">
            <div className="operator-sidebar__logo-icon" data-node-id="3149:2222">
              <ShieldCheck size={22} color="#003C54" strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div className="operator-sidebar__logo-text" data-node-id="3149:2225">
              <span className="operator-sidebar__brand" data-node-id="3149:2223">
                Безопасный город
              </span>
              <span className="operator-sidebar__subtitle" data-node-id="3149:2224">
                Панель модератора
              </span>
            </div>
          </div>

          <nav
            className="operator-sidebar__nav"
            aria-label="Навигация модератора"
            data-node-id="3149:2273"
          >
            <button
              type="button"
              onClick={() => setActiveTab('incidents')}
              className={`operator-sidebar__nav-item ${
                activeTab === 'incidents' ? 'operator-sidebar__nav-item--active' : ''
              }`}
              data-node-id="3149:2237"
            >
              <FileText
                size={20}
                color={activeTab === 'incidents' ? '#00C9B7' : 'rgba(255, 255, 255, 0.75)'}
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="operator-sidebar__nav-label">Обращения</span>
              <span
                className="operator-sidebar__badge operator-sidebar__badge--teal"
                data-node-id="3149:2236"
              >
                {displayedNewCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('map')}
              className="operator-sidebar__nav-item"
              data-node-id="3149:2244"
            >
              <Map size={20} color="rgba(255, 255, 255, 0.75)" strokeWidth={2} aria-hidden="true" />
              <span className="operator-sidebar__nav-label">Карта</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sos')}
              className={`operator-sidebar__nav-item ${
                activeTab === 'sos' ? 'operator-sidebar__nav-item--active' : ''
              }`}
              data-node-id="3149:2258"
            >
              <Siren
                size={20}
                color={activeTab === 'sos' ? '#00C9B7' : 'rgba(255, 255, 255, 0.75)'}
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="operator-sidebar__nav-label">SOS-сигналы</span>
              <span
                className="operator-sidebar__badge operator-sidebar__badge--red"
                data-node-id="3149:2257"
              >
                {sosCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('alerts')}
              className="operator-sidebar__nav-item"
              data-node-id="3149:2264"
            >
              <Bell
                size={20}
                color="rgba(255, 255, 255, 0.75)"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="operator-sidebar__nav-label">Оповещения</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`operator-sidebar__nav-item ${
                activeTab === 'reports' ? 'operator-sidebar__nav-item--active' : ''
              }`}
              data-node-id="3149:2272"
            >
              <LayoutDashboard
                size={20}
                color={activeTab === 'reports' ? '#00C9B7' : 'rgba(255, 255, 255, 0.75)'}
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="operator-sidebar__nav-label">Отчёты</span>
            </button>
          </nav>
        </div>

        <div className="operator-sidebar__bottom" data-node-id="3149:2281">
          <button
            type="button"
            onClick={() => onNavigate?.('home')}
            className="operator-sidebar__back-btn"
          >
            <ArrowLeft size={18} color="#00C9B7" strokeWidth={2} aria-hidden="true" />
            <span>Режим жителя</span>
          </button>

          <div className="operator-sidebar__profile" data-node-id="3149:2280">
            <div className="operator-sidebar__avatar" data-node-id="3149:2276">
              <span>{operatorProfile?.initials || 'М'}</span>
            </div>
            <div className="operator-sidebar__profile-info" data-node-id="3149:2279">
              <span className="operator-sidebar__profile-name" data-node-id="3149:2277">
                {operatorProfile?.name || 'Модератор'}
              </span>
              <span className="operator-sidebar__profile-role" data-node-id="3149:2278">
                {operatorProfile?.role || 'Модератор'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Основная рабочая область (1248px · 3149:2217) */}
      <main className="operator-main" data-node-id="3149:2217">
        {/* Верхняя шапка */}
        <header className="operator-topbar" data-node-id="3149:2214">
          <div className="operator-topbar__titles" data-node-id="3149:2212">
            <div className="operator-topbar__mobile-back-row">
              <button
                type="button"
                onClick={() => onNavigate?.('home')}
                className="operator-mobile-back-btn"
                aria-label="Вернуться на главную"
              >
                <ArrowLeft size={20} color="#1D2A37" strokeWidth={2.2} />
              </button>
              <h1 className="operator-topbar__title" data-node-id="3149:2210">
                Обращения
              </h1>
            </div>
            <p className="operator-topbar__subtitle" data-node-id="3149:2211">
              {operatorProfile?.dateSubtitle}
            </p>
          </div>

          <div className="operator-topbar__actions" data-node-id="3149:2213">
            <button
              type="button"
              onClick={openAlertDialog}
              className="operator-create-alert-btn"
              data-node-id="3149:2201"
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.2} aria-hidden="true" />
              <span>Создать оповещение</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('alerts')}
              className="operator-topbar__bell"
              aria-label="Перейти к оповещениям"
              title="Оповещения"
              data-node-id="3149:2206"
            >
              <Bell size={22} color="#1D2A37" strokeWidth={2} aria-hidden="true" />
              <span className="operator-topbar__bell-dot" aria-hidden="true" />
            </button>

            <div className="operator-topbar__avatar" data-node-id="3149:2209">
              {operatorProfile?.initials || 'М'}
            </div>
          </div>
        </header>

        {/* Ряд 1: 4 карточки метрик (3149:1972) */}
        <section
          className="operator-metrics-row"
          aria-label="Ключевые показатели смены"
          data-node-id="3149:1972"
        >
          <article className="operator-metric-card" data-node-id="3149:1936">
            <div className="operator-metric-card__head" data-node-id="3149:1933">
              <span className="operator-metric-card__label" data-node-id="3149:1924">
                Новые обращения
              </span>
              <div
                className="operator-metric-card__icon operator-metric-card__icon--blue"
                data-node-id="3149:1932"
              >
                <FileText size={18} color="#007DA5" strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
            <div className="operator-metric-card__value" data-node-id="3149:1934">
              {displayedNewCount}
            </div>
            <div
              className="operator-metric-card__footer operator-metric-card__footer--teal"
              data-node-id="3149:1935"
            >
              {newFooter}
            </div>
          </article>

          <article className="operator-metric-card" data-node-id="3149:1946">
            <div className="operator-metric-card__head" data-node-id="3149:1943">
              <span className="operator-metric-card__label" data-node-id="3149:1937">
                В работе
              </span>
              <div
                className="operator-metric-card__icon operator-metric-card__icon--teal"
                data-node-id="3149:1942"
              >
                <Clock size={18} color="#008F82" strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
            <div className="operator-metric-card__value" data-node-id="3149:1944">
              {displayedInProgressCount}
            </div>
            <div className="operator-metric-card__footer" data-node-id="3149:1945">
              {inProgressFooter}
            </div>
          </article>

          <article className="operator-metric-card" data-node-id="3149:1962">
            <div className="operator-metric-card__head" data-node-id="3149:1959">
              <span className="operator-metric-card__label" data-node-id="3149:1947">
                Активные SOS
              </span>
              <div
                className="operator-metric-card__icon operator-metric-card__icon--red"
                data-node-id="3149:1958"
              >
                <Siren size={18} color="#ED0536" strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
            <div
              className="operator-metric-card__value operator-metric-card__value--red"
              data-node-id="3149:1960"
            >
              {sosCount}
            </div>
            <div
              className="operator-metric-card__footer operator-metric-card__footer--red"
              data-node-id="3149:1961"
            >
              Требуют реакции
            </div>
          </article>

          <article className="operator-metric-card" data-node-id="3149:1971">
            <div className="operator-metric-card__head" data-node-id="3149:1968">
              <span className="operator-metric-card__label" data-node-id="3149:1963">
                Среднее время реакции
              </span>
              <div
                className="operator-metric-card__icon operator-metric-card__icon--navy"
                data-node-id="3149:1967"
              >
                <Zap size={18} color="#003C54" strokeWidth={2} aria-hidden="true" />
              </div>
            </div>
            <div className="operator-metric-card__value" data-node-id="3149:1969">
              {reactionLabel}
            </div>
            <div
              className="operator-metric-card__footer operator-metric-card__footer--teal"
              data-node-id="3149:1970"
            >
              {reactionTrend}
            </div>
          </article>
        </section>

        {/* Ряд 2: Левая колонка (Активный SOS + Таблица обращений) и Правая колонка (Карта обращений) */}
        <div className="operator-content-row" data-node-id="3149:2215">
          {/* Левая колонка (764px · 3149:2133) */}
          <div className="operator-left-col" data-node-id="3149:2133">
            {/* Активные SOS жителей (настоящие сигналы с сервера) */}
            {sosSignals.length === 0 ? (
              <section className="operator-sos-empty" aria-label="Активные сигналы SOS">
                <Siren size={20} color="#6B7A89" strokeWidth={2} aria-hidden="true" />
                <span>Активных сигналов SOS нет</span>
              </section>
            ) : (
              sosSignals.map((sos) => (
                <section
                  key={sos.id}
                  className="operator-sos-banner"
                  aria-label={`Активный сигнал SOS: ${sos.userName}`}
                >
                  <div className="operator-sos-banner__icon">
                    <Siren size={22} color="#FFFFFF" strokeWidth={2.2} aria-hidden="true" />
                  </div>

                  <div className="operator-sos-banner__info">
                    <span className="operator-sos-banner__title">
                      Активный SOS · {sos.userName}
                    </span>
                    <span className="operator-sos-banner__sub">
                      {sos.address} ·{' '}
                      <a href={`tel:${sos.phone}`} className="operator-sos-banner__phone">
                        {sos.displayPhone}
                      </a>{' '}
                      · {elapsedLabel(now - sos.startedAt)} · получили контактов:{' '}
                      {sos.notifiedCount}
                    </span>
                  </div>

                  <div className="operator-sos-banner__actions">
                    <button
                      type="button"
                      onClick={() => handleResolve(sos)}
                      disabled={resolvingId === sos.id}
                      className="operator-sos-banner__accept-btn"
                    >
                      <Check size={16} color="#FFFFFF" strokeWidth={2.5} aria-hidden="true" />
                      <span>{resolvingId === sos.id ? 'Закрываем...' : 'Помощь пришла'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate?.('map')}
                      className="operator-sos-banner__map-btn"
                    >
                      <MapPin size={18} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                      <span>На карте</span>
                    </button>
                  </div>
                </section>
              ))
            )}

            {/* Заголовок секции «Обращения жителей» */}
            <div className="operator-section-header" data-node-id="3149:2132">
              <h2 className="operator-section-header__title" data-node-id="3149:2131">
                Обращения жителей
              </h2>
              <button
                type="button"
                onClick={() => setStatusFilter((prev) => NEXT_FILTER[prev] || 'all')}
                className="operator-section-header__link"
                data-node-id="3149:2130"
              >
                {FILTER_LABELS[statusFilter]}
              </button>
            </div>

            {/* Таблица обращений (3149:2129) */}
            <div className="operator-table-card" data-node-id="3149:2129">
              <div className="operator-table-header" data-node-id="3149:2062">
                <div className="operator-col operator-col--id">ID</div>
                <div className="operator-col operator-col--type">ТИП</div>
                <div className="operator-col operator-col--address">АДРЕС</div>
                <div className="operator-col operator-col--time">ВРЕМЯ</div>
                <div className="operator-col operator-col--status">СТАТУС</div>
                <div className="operator-col operator-col--service">ЗАМЕТКА</div>
              </div>

              {visibleIncidents.map((inc) => {
                const typeCfg = INCIDENT_TYPE_ICONS[inc.icon] || INCIDENT_TYPE_ICONS.car;
                const TypeIcon = typeCfg.Icon;
                const badgeCfg = STATUS_BADGE_STYLES[inc.status] || STATUS_BADGE_STYLES.new;

                return (
                  <div
                    key={inc.id}
                    className={`operator-table-row ${
                      inc.status === 'hidden' ? 'operator-table-row--hidden' : ''
                    }`}
                  >
                    <div className="operator-col operator-col--id operator-cell-id">{inc.id}</div>

                    <div className="operator-col operator-col--type operator-cell-type">
                      <TypeIcon
                        size={18}
                        color={typeCfg.color}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span>{inc.typeLabel}</span>
                    </div>

                    <div className="operator-col operator-col--address operator-cell-text">
                      {inc.address}
                    </div>

                    <div className="operator-col operator-col--time operator-cell-muted">
                      {inc.time}
                    </div>

                    <div className="operator-col operator-col--status">
                      <select
                        className="operator-status-select"
                        value={inc.status}
                        onChange={(e) => handleStatusChange(inc, e.target.value)}
                        aria-label={`Статус обращения ${inc.id}`}
                        style={{ backgroundColor: badgeCfg.bg, color: badgeCfg.color }}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_BADGE_STYLES[status].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="operator-col operator-col--service operator-cell-service">
                      <NoteCell
                        incident={inc}
                        onSave={(note) => onUpdateIncidentStatus?.(inc.id, inc.status, note)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Оповещения: модератор правит, снимает с публикации и возвращает */}
            <div className="operator-section-header">
              <h2 className="operator-section-header__title">Оповещения</h2>
              <button
                type="button"
                onClick={openAlertDialog}
                className="operator-section-header__link"
              >
                Создать
              </button>
            </div>
            <div className="operator-alerts-card">
              {alerts.length === 0 && (
                <p className="operator-alerts-card__empty">Оповещений пока нет</p>
              )}
              {alerts.map((alert) => {
                const published = alert.isPublished !== false;
                const levelCfg = ALERT_LEVEL_CONFIG[alert.level] || ALERT_LEVEL_CONFIG.warning;
                return (
                  <div
                    key={alert.id}
                    className={`operator-alert-row ${published ? '' : 'operator-alert-row--hidden'}`}
                  >
                    <div className="operator-alert-row__info">
                      <span className="operator-alert-row__title">{alert.title}</span>
                      <span className="operator-alert-row__meta">
                        <span style={{ color: levelCfg.accentColor }}>
                          {ALERT_LEVEL_LABELS[alert.level] || alert.level}
                        </span>{' '}
                        · {alert.detailedTime || alert.timeAgo} ·{' '}
                        {published ? 'в ленте' : 'снято с публикации'}
                      </span>
                    </div>
                    <div className="operator-alert-row__actions">
                      <button
                        type="button"
                        onClick={() => openEditAlertDialog(alert)}
                        className="operator-alert-row__btn"
                      >
                        <Pencil size={14} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                        <span>Изменить</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAlertPublished(alert)}
                        disabled={alertTogglingId === alert.id}
                        className="operator-alert-row__btn"
                      >
                        {published ? (
                          <EyeOff size={14} color="#ED0536" strokeWidth={2} aria-hidden="true" />
                        ) : (
                          <Eye size={14} color="#008F82" strokeWidth={2} aria-hidden="true" />
                        )}
                        <span>{published ? 'Снять' : 'Вернуть'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Правая колонка: Карта обращений (380px · 3149:2195) */}
          <aside className="operator-map-card" data-node-id="3149:2195">
            <div className="operator-map-card__head" data-node-id="3149:2136">
              <h2 className="operator-map-card__title" data-node-id="3149:2135">
                Карта обращений
              </h2>
              <button
                type="button"
                onClick={() => onNavigate?.('map')}
                className="operator-map-card__expand"
                data-node-id="3149:2134"
              >
                Развернуть
              </button>
            </div>

            <div
              className="operator-mini-map"
              onClick={() => onNavigate?.('map')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onNavigate?.('map');
              }}
              aria-label="Открыть полную карту обращений"
              data-node-id="3149:2137"
            >
              <div className="operator-mini-map__grid" aria-hidden="true">
                {Array.from({ length: 16 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`operator-mini-map__block ${
                      idx === 4 || idx === 11 ? 'operator-mini-map__block--park' : ''
                    }`}
                  />
                ))}
              </div>

              <div className="operator-mini-map__road-h" aria-hidden="true" />
              <div className="operator-mini-map__road-v" aria-hidden="true" />

              {/* Опасная зона */}
              <div className="operator-mini-map__danger-zone" data-node-id="3149:2165" />

              {/* Пины */}
              <div
                className="operator-mini-pin operator-mini-pin--danger"
                style={{ left: '44%', top: '48%' }}
                data-node-id="3149:2171"
              >
                <Siren size={16} color="#FFFFFF" strokeWidth={2.2} />
              </div>

              <div
                className="operator-mini-pin operator-mini-pin--fire"
                style={{ left: '68%', top: '24%' }}
                data-node-id="3149:2175"
              >
                <Flame size={16} color="#FFFFFF" strokeWidth={2.2} />
              </div>

              <div
                className="operator-mini-pin operator-mini-pin--police"
                style={{ left: '24%', top: '73%' }}
                data-node-id="3149:2179"
              >
                <Shield size={16} color="#FFFFFF" strokeWidth={2.2} />
              </div>

              <div
                className="operator-mini-pin operator-mini-pin--hospital"
                style={{ left: '78%', top: '68%' }}
                data-node-id="3149:2184"
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              </div>
            </div>

            <div className="operator-map-legend" data-node-id="3149:2194">
              <div className="operator-map-legend__item" data-node-id="3149:2187">
                <span className="operator-map-legend__dot" style={{ backgroundColor: '#ED0536' }} />
                <span>Новые</span>
              </div>
              <div className="operator-map-legend__item" data-node-id="3149:2190">
                <span className="operator-map-legend__dot" style={{ backgroundColor: '#007DA5' }} />
                <span>В работе</span>
              </div>
              <div className="operator-map-legend__item" data-node-id="3149:2193">
                <span className="operator-map-legend__dot" style={{ backgroundColor: '#008F82' }} />
                <span>Закрытые</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Модальное окно создания городского оповещения */}
      <dialog
        ref={alertDialogRef}
        closedby="any"
        className="contacts-dialog"
        onClick={handleDialogBackdropClick}
      >
        <div className="contacts-dialog__content">
          <div className="contacts-dialog__header">
            <h2 className="contacts-dialog__title">
              {editingAlert ? 'Изменить оповещение' : 'Создать городское оповещение'}
            </h2>
            <button
              type="button"
              onClick={closeAlertDialog}
              className="contacts-dialog__close"
              aria-label="Закрыть окно"
            >
              <X size={20} color="#6B7A89" />
            </button>
          </div>

          <form className="contacts-dialog__form" onSubmit={handleCreateAlertSubmit}>
            <div className="contacts-dialog__field">
              <label htmlFor="alert-title" className="contacts-dialog__label">
                Заголовок оповещения
              </label>
              <input
                id="alert-title"
                type="text"
                required
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                placeholder="Например: Сильный снегопад и гололедица"
                className="contacts-dialog__input"
              />
            </div>

            <div className="contacts-dialog__field">
              <label htmlFor="alert-level" className="contacts-dialog__label">
                Уровень важности
              </label>
              <select
                id="alert-level"
                value={alertLevel}
                onChange={(e) => setAlertLevel(e.target.value)}
                className="contacts-dialog__input"
              >
                <option value="warning">Предупреждение</option>
                <option value="info">Информация</option>
                <option value="critical">Критическое</option>
              </select>
            </div>

            <div className="contacts-dialog__field">
              <label htmlFor="alert-subtitle" className="contacts-dialog__label">
                Коротко (подзаголовок)
              </label>
              <input
                id="alert-subtitle"
                type="text"
                maxLength={200}
                value={alertSubtitle}
                onChange={(e) => setAlertSubtitle(e.target.value)}
                placeholder="Необязательно. Например: ветер до 25 м/с"
                className="contacts-dialog__input"
              />
            </div>

            <div className="contacts-dialog__field">
              <label htmlFor="alert-location" className="contacts-dialog__label">
                Район или территория
              </label>
              <input
                id="alert-location"
                type="text"
                value={alertLocation}
                onChange={(e) => setAlertLocation(e.target.value)}
                placeholder="Укажите район (например: Весь город)"
                className="contacts-dialog__input"
              />
            </div>

            <div className="contacts-dialog__field">
              <label htmlFor="alert-source" className="contacts-dialog__label">
                Источник
              </label>
              <input
                id="alert-source"
                type="text"
                value={alertSource}
                onChange={(e) => setAlertSource(e.target.value)}
                placeholder="Необязательно. Без источника будет «Безопасный город»"
                className="contacts-dialog__input"
              />
            </div>

            <div className="contacts-dialog__field">
              <label htmlFor="alert-desc" className="contacts-dialog__label">
                Текст оповещения
              </label>
              <textarea
                id="alert-desc"
                rows={3}
                required
                value={alertDescription}
                onChange={(e) => setAlertDescription(e.target.value)}
                placeholder="Введите подробную информацию и рекомендации для жителей"
                className="contacts-dialog__input"
              />
            </div>

            {alertError && (
              <p className="contacts-dialog__error" role="alert">
                {alertError}
              </p>
            )}

            <div className="contacts-dialog__actions">
              <button type="button" onClick={closeAlertDialog} className="contacts-dialog__cancel">
                Отмена
              </button>
              <button type="submit" disabled={alertSubmitting} className="contacts-dialog__submit">
                {alertSubmitting ? 'Сохраняем...' : editingAlert ? 'Сохранить' : 'Опубликовать'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}
