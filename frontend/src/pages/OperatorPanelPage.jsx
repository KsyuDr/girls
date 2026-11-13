import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  FileText,
  Siren,
  Bell,
  Plus,
  Clock,
  Zap,
  MapPin,
  Car,
  Flame,
  CloudRain,
  Users,
  MoreHorizontal,
  Check,
  X,
  Pencil,
  EyeOff,
  Eye,
  ArrowRight,
  HandHelping,
  Search,
  PackageCheck,
} from 'lucide-react';
import { elapsedLabel, ALERT_LEVEL_CONFIG, nearCenter } from '../services/adapters';
import { AppSidebar, AccountMenu, MobileTabbar } from '../components/AppShell';
import { useShell } from '../components/shellContext';
import { useConfirm } from '../components/confirmContext';
import StatusMenu from '../components/StatusMenu';
import './OperatorPanelPage.css';

const CityMap = lazy(() => import('../components/CityMap'));

// Цвет точки на мини-карте — по статусу обращения
const STATUS_PIN_COLORS = {
  new: '#ED0536',
  in_progress: '#007DA5',
  closed: '#008F82',
  hidden: '#8A97A5',
};

// Иконка по типу метки (как в справочнике бэкенда, reference/catalog.py)
const INCIDENT_TYPE_ICONS = {
  car: { Icon: Car, color: '#007DA5' },
  flame: { Icon: Flame, color: '#ED0536' },
  'cloud-rain': { Icon: CloudRain, color: '#007DA5' },
  users: { Icon: Users, color: '#ED0536' },
  zap: { Icon: Zap, color: '#003C54' },
  'hand-helping': { Icon: HandHelping, color: '#008F82' },
  search: { Icon: Search, color: '#6B7A89' },
  'package-check': { Icon: PackageCheck, color: '#008F82' },
  'more-horizontal': { Icon: MoreHorizontal, color: '#6B7A89' },
};

const STATUS_BADGE_STYLES = {
  new: { bg: '#FDE7EC', color: '#ED0536', label: 'Новое' },
  in_progress: { bg: '#E5F2F7', color: '#007DA5', label: 'В работе' },
  closed: { bg: '#E0F7F4', color: '#008F82', label: 'Закрыто' },
  hidden: { bg: '#EDF1F5', color: '#6B7A89', label: 'Скрыто' },
};

const STATUS_OPTIONS = ['new', 'in_progress', 'closed', 'hidden'].map((value) => ({
  value,
  ...STATUS_BADGE_STYLES[value],
}));

// Что сообщить после смены статуса
const STATUS_DONE_TEXT = {
  new: 'снова новое',
  in_progress: 'взято в работу',
  closed: 'закрыто',
  hidden: 'скрыто с карты',
};

function StatusPill({ status }) {
  const cfg = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.new;
  return (
    <span className="operator-status-pill" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <span className="operator-status-pill__dot" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

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
  onShowOnMap,
  focusSection = 'incidents',
  mapCenter = null,
  onNavigate,
}) {
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'new' | 'in_progress' | 'hidden'
  const [resolvingId, setResolvingId] = useState(null);
  const [savingStatusId, setSavingStatusId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const confirm = useConfirm();
  const { onNotify } = useShell();

  const sosSectionRef = useRef(null);

  // Пункт меню «SOS-сигналы» ведёт на эту же страницу и прокручивает к сигналам
  useEffect(() => {
    if (focusSection === 'sos') sosSectionRef.current?.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [focusSection]);

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

  const miniMapMarkers = useMemo(
    () => [
      // Точки дальше 30 км от центра (ошибочные координаты) не растягивают карту на весь мир
      ...(mapCenter ? nearCenter(incidents, mapCenter) : incidents)
        .filter((inc) => typeof inc.lat === 'number' && typeof inc.lng === 'number')
        .map((inc) => ({
          id: `inc-${inc.rawId ?? inc.id}`,
          lat: inc.lat,
          lng: inc.lng,
          color: STATUS_PIN_COLORS[inc.status] || STATUS_PIN_COLORS.new,
          icon: inc.icon === 'flame' ? 'flame' : 'triangle-alert',
          label: `${inc.id} ${inc.typeLabel} — ${inc.address}`,
          kind: 'place',
        })),
      ...sosSignals
        .filter((sos) => typeof sos.lat === 'number' && typeof sos.lng === 'number')
        .map((sos) => ({
          id: `sos-${sos.id}`,
          lat: sos.lat,
          lng: sos.lng,
          color: '#ED0536',
          icon: 'siren',
          label: `SOS: ${sos.userName} — ${sos.address}`,
          kind: 'sos',
        })),
    ],
    [incidents, sosSignals, mapCenter]
  );

  // Клик по SOS на мини-карте открывает большую карту с этим сигналом
  const handleMiniMapSelect = (markerId) => {
    const sos = sosSignals.find((s) => `sos-${s.id}` === markerId);
    if (sos) onShowOnMap?.({ type: 'sos', id: sos.id, lat: sos.lat, lng: sos.lng });
  };

  const visibleIncidents =
    statusFilter === 'all' ? incidents : incidents.filter((inc) => inc.status === statusFilter);

  // Статус выбирается явно; «Скрыть», «Закрыть» и возврат скрытой метки — с подтверждением
  const handleStatusChange = async (incident, nextStatus) => {
    if (nextStatus === incident.status) return;
    let question = null;
    if (nextStatus === 'hidden') {
      question = {
        title: `Скрыть метку ${incident.id}?`,
        message: 'Она пропадёт с карты у всех жителей. Вернуть можно в любой момент.',
        confirmLabel: 'Скрыть метку',
        tone: 'danger',
      };
    } else if (incident.status === 'hidden') {
      question = {
        title: `Вернуть метку ${incident.id} на карту?`,
        message: 'Её снова увидят все жители.',
        confirmLabel: 'Вернуть на карту',
        tone: 'primary',
      };
    } else if (nextStatus === 'closed') {
      question = {
        title: `Закрыть обращение ${incident.id}?`,
        message: 'Отклики помощников будут отмечены выполненными.',
        confirmLabel: 'Закрыть обращение',
        tone: 'success',
      };
    }
    if (question) {
      const ok = await confirm({
        ...question,
        content: (
          <div className="ui-status-change" aria-label="Смена статуса">
            <span className="operator-status-change__what">
              {incident.typeLabel} · {incident.address}
            </span>
            <StatusPill status={incident.status} />
            <ArrowRight
              size={18}
              strokeWidth={2.4}
              className="ui-status-change__arrow"
              aria-hidden="true"
            />
            <StatusPill status={nextStatus} />
          </div>
        ),
      });
      if (!ok) return;
    }
    setSavingStatusId(incident.id);
    const saved = await onUpdateIncidentStatus?.(incident.id, nextStatus);
    setSavingStatusId(null);
    if (saved !== false) {
      onNotify(`Обращение ${incident.id} ${STATUS_DONE_TEXT[nextStatus] || 'обновлено'}`);
      setFlashId(incident.id);
    }
  };

  const handleResolve = async (sos) => {
    const ok = await confirm({
      title: 'Помощь пришла?',
      message: `Сигнал SOS (${sos.userName}) будет закрыт: у жителя на экране появится «помощь пришла», а его близким уйдёт сообщение об этом. Отменить это нельзя.`,
      confirmLabel: 'Да, помощь пришла',
      cancelLabel: 'Ещё нет',
      tone: 'success',
    });
    if (!ok) return;
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
    const ok = await confirm(
      published
        ? {
            title: 'Снять оповещение с публикации?',
            message: `«${alert.title}» пропадёт из ленты у всех жителей. Вернуть можно в любой момент.`,
            confirmLabel: 'Снять с публикации',
            tone: 'danger',
          }
        : {
            title: 'Вернуть оповещение в ленту?',
            message: `«${alert.title}» снова увидят все жители.`,
            confirmLabel: 'Вернуть в ленту',
            tone: 'primary',
          }
    );
    if (!ok) return;
    setAlertTogglingId(alert.id);
    try {
      await onUpdateAlert?.(
        alert.id,
        { isPublished: !published },
        published ? 'Оповещение снято с публикации' : 'Оповещение снова в ленте'
      );
    } catch (error) {
      onNotify(error?.message || 'Не удалось изменить оповещение', 'error');
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
      <AppSidebar />

      {/* Основная рабочая область (1248px · 3149:2217) */}
      <main className="operator-main page-enter" data-node-id="3149:2217">
        {/* Верхняя шапка */}
        <header className="operator-topbar" data-node-id="3149:2214">
          <div className="operator-topbar__titles" data-node-id="3149:2212">
            <h1 className="operator-topbar__title" data-node-id="3149:2210">
              {focusSection === 'sos' ? 'SOS-сигналы' : 'Обращения'}
            </h1>
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
              <span className="operator-create-alert-btn__label">Создать оповещение</span>
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

            <AccountMenu className="operator-topbar__avatar" />
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
            <div className="operator-sos-section" ref={sosSectionRef} id="operator-sos">
              <div className="operator-section-header">
                <h2 className="operator-section-header__title">
                  Активные SOS{sosSignals.length > 0 ? ` · ${sosSignals.length}` : ''}
                </h2>
              </div>
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
                        onClick={() =>
                          onShowOnMap?.({
                            type: 'sos',
                            id: sos.id,
                            lat: sos.lat,
                            lng: sos.lng,
                          })
                        }
                        disabled={typeof sos.lat !== 'number'}
                        title={
                          typeof sos.lat === 'number'
                            ? 'Показать место сигнала на карте'
                            : 'У сигнала нет координат — только адрес'
                        }
                        className="operator-sos-banner__map-btn"
                      >
                        <MapPin size={18} color="#007DA5" strokeWidth={2} aria-hidden="true" />
                        <span>{typeof sos.lat === 'number' ? 'На карте' : 'Нет координат'}</span>
                      </button>
                    </div>
                  </section>
                ))
              )}
            </div>

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
                const typeCfg =
                  INCIDENT_TYPE_ICONS[inc.icon] || INCIDENT_TYPE_ICONS['more-horizontal'];
                const TypeIcon = typeCfg.Icon;

                return (
                  <div
                    key={inc.id}
                    className={`operator-table-row ${
                      inc.status === 'hidden' ? 'operator-table-row--hidden' : ''
                    } ${flashId === inc.id ? 'operator-table-row--flash' : ''}`}
                    onAnimationEnd={(e) => {
                      if (e.animationName === 'operator-row-flash') setFlashId(null);
                    }}
                  >
                    <div data-label="ID" className="operator-col operator-col--id operator-cell-id">
                      {inc.id}
                    </div>

                    <div
                      data-label="Тип"
                      className="operator-col operator-col--type operator-cell-type"
                    >
                      <TypeIcon
                        size={18}
                        color={typeCfg.color}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span>{inc.typeLabel}</span>
                    </div>

                    <div
                      data-label="Адрес"
                      className="operator-col operator-col--address operator-cell-text"
                    >
                      {inc.address}
                    </div>

                    <div
                      data-label="Время"
                      className="operator-col operator-col--time operator-cell-muted"
                    >
                      {inc.time}
                    </div>

                    <div data-label="Статус" className="operator-col operator-col--status">
                      <StatusMenu
                        value={inc.status}
                        options={STATUS_OPTIONS}
                        onChange={(next) => handleStatusChange(inc, next)}
                        ariaLabel={`Статус обращения ${inc.id}`}
                        disabled={savingStatusId === inc.id}
                      />
                    </div>

                    <div
                      data-label="Заметка"
                      className="operator-col operator-col--service operator-cell-service"
                    >
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

            <div className="operator-mini-map">
              <Suspense
                fallback={<div className="operator-mini-map__loading">Загружаем карту…</div>}
              >
                <CityMap
                  center={mapCenter}
                  markers={miniMapMarkers}
                  autoFit
                  onSelect={handleMiniMapSelect}
                  ariaLabel="Карта обращений и сигналов SOS"
                />
              </Suspense>
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
              <div className="operator-map-legend__item">
                <span className="operator-map-legend__dot operator-map-legend__dot--sos" />
                <span>SOS</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <MobileTabbar />

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
