import { useState, useEffect, useRef, useCallback } from 'react';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import SosSentPage from './pages/SosSentPage';
import ContactsPage from './pages/ContactsPage';
import GuidesPage from './pages/GuidesPage';
import AlertsPage from './pages/AlertsPage';
import MapPage from './pages/MapPage';
import ReportPage from './pages/ReportPage';
import OperatorPanelPage from './pages/OperatorPanelPage';
import {
  USE_MOCK,
  getDashboardData,
  sendSosSignal,
  cancelSosSignal,
  resolveSos,
  toggleContactSos,
  addEmergencyContact,
  deleteEmergencyContact,
  togglePushNotifications,
  submitIncidentReport,
  updateIncidentStatus,
  createCityAlert,
  updateCityAlert,
  uploadIncidentPhotos,
  getSosSignal,
  logout,
} from './services/api';
import { GUEST_USER } from './services/adapters';
import {
  INITIAL_USER,
  EMERGENCY_SERVICES,
  RECENT_ALERTS,
  SAFETY_GUIDES,
  EMERGENCY_CONTACTS,
  MAX_EMERGENCY_CONTACTS,
  SOS_WAITING_TIPS,
  MAP_FILTER_CATEGORIES,
  MAP_PLACES,
  INCIDENT_TYPES,
  REPORT_NEXT_STEPS,
  INITIAL_OPERATOR_INCIDENTS,
  OPERATOR_PROFILE,
} from './mock/data';
import './App.css';

// Как часто перечитываем данные с сервера (в проекте нет push/WebSocket, см. решение 14)
const REFRESH_INTERVAL_MS = 20000;

// Почему SOS пропал с сервера — по статусу завершённого сигнала
const SOS_END_MESSAGES = {
  resolved: 'Сигнал SOS завершён: модератор отметил, что помощь пришла',
  cancelled: 'Сигнал SOS отменён на другом устройстве',
};

// Разделы только для вошедших: гость не должен заполнять форму, которую не сможет отправить
const LOGIN_REQUIRED = {
  report: 'Войдите, чтобы сообщать о происшествиях',
  contacts: 'Войдите, чтобы добавить экстренные контакты',
};

// С бэкендом до загрузки данных показываем пустое «гостевое» состояние, а не моки:
// иначе человек увидел бы чужие имя, контакты и оповещения из макета.
const EMPTY_DASHBOARD = {
  user: GUEST_USER,
  isAuthenticated: false,
  services: [],
  alerts: [],
  guides: [],
  contacts: [],
  maxContacts: MAX_EMERGENCY_CONTACTS,
  sosWaitingTips: [],
  mapCategories: [],
  mapPlaces: [],
  incidentTypes: [],
  reportNextSteps: [],
  operatorIncidents: [],
  operatorSos: [],
  operatorStats: null,
  operatorAlerts: [],
  operatorProfile: { initials: 'М', name: 'Модератор', role: 'Модератор', dateSubtitle: '' },
};

const MOCK_DASHBOARD = {
  user: INITIAL_USER,
  isAuthenticated: true,
  services: EMERGENCY_SERVICES,
  alerts: RECENT_ALERTS,
  guides: SAFETY_GUIDES,
  contacts: EMERGENCY_CONTACTS,
  maxContacts: MAX_EMERGENCY_CONTACTS,
  sosWaitingTips: SOS_WAITING_TIPS,
  mapCategories: MAP_FILTER_CATEGORIES,
  mapPlaces: MAP_PLACES,
  incidentTypes: INCIDENT_TYPES,
  reportNextSteps: REPORT_NEXT_STEPS,
  operatorIncidents: INITIAL_OPERATOR_INCIDENTS,
  operatorSos: [],
  operatorStats: null,
  operatorAlerts: RECENT_ALERTS,
  operatorProfile: OPERATOR_PROFILE,
};

function App() {
  // 'register' | 'home' | 'sos' | 'contacts' | 'guides' | 'alerts' | 'map' | 'report' | 'operator'
  const [currentPage, setCurrentPage] = useState('register');
  const [sosSession, setSosSession] = useState(null);
  const [dashboard, setDashboard] = useState(USE_MOCK ? MOCK_DASHBOARD : EMPTY_DASHBOARD);
  const [dataLoaded, setDataLoaded] = useState(USE_MOCK);
  const [connectionError, setConnectionError] = useState('');
  const [notice, setNotice] = useState(null); // {text, type: 'info' | 'error'}
  const [sosConfirmOpen, setSosConfirmOpen] = useState(false);

  // Актуальные значения для таймеров и ответов, пришедших позже
  const pageRef = useRef(currentPage);
  const sosRef = useRef(sosSession);
  // «Эпоха» состояния: растёт при отправке/отмене SOS, входе и выходе. Ответ /dashboard,
  // запрошенный до такого события, устарел и не должен «воскресить» сигнал или вход.
  const epochRef = useRef(0);
  useEffect(() => {
    pageRef.current = currentPage;
  }, [currentPage]);
  useEffect(() => {
    sosRef.current = sosSession;
  }, [sosSession]);

  const notify = useCallback(
    (text, type = 'info') => setNotice({ text, type, id: Date.now() }),
    []
  );

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  const bumpEpoch = () => {
    epochRef.current += 1;
  };

  const startSosSession = (session) => {
    bumpEpoch();
    setSosSession(session);
  };

  /**
   * Загрузка данных. silent — фоновое обновление: не трогает страницу, кроме двух случаев,
   * когда сервер говорит, что состояние изменилось (SOS завершён, роль модератора снята).
   */
  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      const epoch = epochRef.current;
      const data = await getDashboardData();
      if (epoch !== epochRef.current) return null; // пока шёл запрос, состояние изменилось
      setDashboard((prev) => ({ ...prev, ...data }));
      setDataLoaded(true);
      setConnectionError('');

      if (!silent && data.isAuthenticated) {
        // Есть действующий токен — регистрация не нужна
        setCurrentPage((page) => (page === 'register' ? 'home' : page));
      }

      if (data.activeSos) {
        if (!sosRef.current || sosRef.current.id === data.activeSos.id) {
          setSosSession(data.activeSos);
        }
      } else if (!USE_MOCK && sosRef.current) {
        // На сервере сигнала уже нет: его завершил модератор («помощь пришла») или его
        // отменили на другом устройстве — спросим у сервера, что именно случилось
        const ended = sosRef.current;
        setSosSession(null);
        if (pageRef.current === 'sos') setCurrentPage('home');
        getSosSignal(ended.id).then((sos) =>
          notify(SOS_END_MESSAGES[sos?.status] || 'Сигнал SOS завершён')
        );
      }

      if (!USE_MOCK && pageRef.current === 'operator' && !data.user?.isModerator) {
        setCurrentPage('home');
      }
      return data;
    },
    [notify]
  );

  const refreshQuietly = useCallback(() => {
    loadDashboard({ silent: true }).catch((error) => console.error(error));
  }, [loadDashboard]);

  // Первая загрузка данных при открытии приложения
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка с сервера: setState вызывается после ответа
    loadDashboard().catch((error) => {
      console.error(error);
      setConnectionError(error?.message || 'Нет связи с сервером');
    });
  }, [loadDashboard]);

  // Периодически перечитываем данные: новые метки, оповещения, SOS для модератора.
  // В режиме моков данных на сервере нет, обновлять нечего.
  useEffect(() => {
    if (USE_MOCK || !dataLoaded) return undefined;
    const timer = setInterval(() => {
      if (document.hidden || pageRef.current === 'register') return;
      refreshQuietly();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [dataLoaded, refreshQuietly]);

  const isAuthenticated = USE_MOCK || Boolean(dashboard.isAuthenticated);
  const canModerate = USE_MOCK || Boolean(dashboard.user?.isModerator);

  // 401 → на экран входа; true, если перенаправили
  const redirectIfUnauthorized = (error) => {
    if (error?.status !== 401) return false;
    bumpEpoch();
    setDashboard((prev) => ({ ...prev, isAuthenticated: false, user: GUEST_USER }));
    setCurrentPage('register');
    notify(isAuthenticated ? 'Сессия истекла — войдите снова' : 'Сначала войдите', 'error');
    return true;
  };

  // Ошибка действия вне формы: сообщение вверху экрана, без alert
  const handleApiError = (error) => {
    if (redirectIfUnauthorized(error)) return;
    notify(error?.message || 'Что-то пошло не так. Попробуйте ещё раз', 'error');
  };

  const handleRegistrationSuccess = (updatedUser) => {
    bumpEpoch();
    setDashboard((prev) => ({ ...prev, user: updatedUser, isAuthenticated: true }));
    setCurrentPage('home');
    loadDashboard().catch((error) => console.error(error));
  };

  const handleLogout = () => {
    logout();
    bumpEpoch();
    setSosSession(null);
    setDashboard((prev) => ({
      ...prev,
      user: GUEST_USER,
      isAuthenticated: false,
      contacts: [],
      operatorIncidents: [],
      operatorSos: [],
      operatorStats: null,
      operatorAlerts: [],
    }));
    setCurrentPage('register');
    if (!USE_MOCK) loadDashboard({ silent: true }).catch((error) => console.error(error));
  };

  const handleNavigate = (page) => {
    if (page === 'sos-sent' || page === 'sos') {
      setCurrentPage('sos');
      return;
    }
    if (page === 'operator' && !canModerate) {
      notify('Панель модератора доступна только модераторам', 'error');
      return;
    }
    if (LOGIN_REQUIRED[page] && !isAuthenticated) {
      setCurrentPage('register');
      notify(LOGIN_REQUIRED[page], 'error');
      return;
    }
    setCurrentPage(page);
  };

  // ---------- SOS ----------

  // Любая кнопка SOS, кроме удержания на главной, сначала спрашивает подтверждение:
  // случайное касание в кармане не должно отправлять сигнал близким
  const handleRequestSos = () => {
    if (sosRef.current) {
      setCurrentPage('sos');
      return;
    }
    if (!isAuthenticated) {
      setCurrentPage('register');
      notify('Войдите, чтобы отправлять SOS близким. Если вы в опасности — звоните 112', 'error');
      return;
    }
    setSosConfirmOpen(true);
  };

  const handleTriggerSos = async () => {
    setSosConfirmOpen(false);
    if (sosRef.current) {
      setCurrentPage('sos');
      return;
    }
    if (!isAuthenticated) {
      handleRequestSos();
      return;
    }
    try {
      const session = await sendSosSignal(
        {
          coordinates: dashboard.user.coordinates,
          address: dashboard.user.address,
        },
        {
          // Координаты браузера досылаются после отправки сигнала
          onLocationUpdate: (updated) =>
            setSosSession((prev) => (prev && prev.id === updated.id ? updated : prev)),
        }
      );
      startSosSession(session);
      setCurrentPage('sos');
    } catch (error) {
      if (redirectIfUnauthorized(error)) return;
      notify(`${error?.message || 'Не удалось отправить SOS'}. Позвоните 112`, 'error');
    }
  };

  // Ошибку отмены не глотаем: экран SOS остаётся, пока сервер не подтвердит отмену
  const handleCancelSos = async () => {
    try {
      if (sosSession?.id) {
        await cancelSosSignal(sosSession.id);
      }
    } catch (error) {
      if (redirectIfUnauthorized(error)) return;
      // 404/409 — сигнал уже завершён на сервере, отменять нечего
      if (error?.status !== 404 && error?.status !== 409) throw error;
    }
    bumpEpoch();
    setSosSession(null);
    setCurrentPage('home');
  };

  // ---------- контакты и профиль ----------

  const handleToggleContactSos = async (contactId, nextReceivesSos) => {
    try {
      const updatedContacts = await toggleContactSos(contactId, nextReceivesSos);
      setDashboard((prev) => ({ ...prev, contacts: updatedContacts }));
    } catch (error) {
      handleApiError(error);
    }
  };

  // Формы (контакт, оповещение) сами показывают ошибку и не закрываются: здесь только пробрасываем
  const handleAddContact = async (contactPayload) => {
    try {
      const updatedContacts = await addEmergencyContact(contactPayload);
      setDashboard((prev) => ({ ...prev, contacts: updatedContacts }));
    } catch (error) {
      redirectIfUnauthorized(error);
      throw error;
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      const updatedContacts = await deleteEmergencyContact(contactId);
      setDashboard((prev) => ({ ...prev, contacts: updatedContacts }));
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleTogglePushNotifications = async (enabled) => {
    try {
      const updatedUser = await togglePushNotifications(enabled);
      setDashboard((prev) => ({ ...prev, user: updatedUser }));
    } catch (error) {
      handleApiError(error);
    }
  };

  // ---------- метки, панель модератора, оповещения ----------

  const handleSubmitReport = async (payload) => {
    try {
      const result = await submitIncidentReport(payload);
      if (USE_MOCK && result?.incidents) {
        setDashboard((prev) => ({ ...prev, operatorIncidents: result.incidents }));
      } else {
        refreshQuietly(); // новая метка сразу появляется на карте
      }
      return result;
    } catch (error) {
      redirectIfUnauthorized(error);
      throw error;
    }
  };

  // Фото к уже созданной метке (повтор тех, что не загрузились)
  const handleUploadPhotos = async (incidentId, files) => {
    try {
      const result = await uploadIncidentPhotos(incidentId, files);
      refreshQuietly();
      return result;
    } catch (error) {
      redirectIfUnauthorized(error);
      throw error;
    }
  };

  // note: строка — сохранить заметку модератора, undefined — не трогать
  const handleUpdateIncidentStatus = async (incidentId, nextStatus, note) => {
    try {
      const updatedIncidents = await updateIncidentStatus(incidentId, nextStatus, note);
      setDashboard((prev) => ({ ...prev, operatorIncidents: updatedIncidents }));
      if (!USE_MOCK) refreshQuietly(); // счётчики и карта
      return true;
    } catch (error) {
      handleApiError(error);
      return false;
    }
  };

  const handleResolveSos = async (sosId) => {
    try {
      await resolveSos(sosId);
      notify('Сигнал SOS отмечен как завершённый');
    } catch (error) {
      if (error?.status === 409) {
        notify('Этот сигнал SOS уже завершён');
      } else {
        handleApiError(error);
        return;
      }
    }
    refreshQuietly();
  };

  const handleCreateCityAlert = async (alertPayload) => {
    try {
      const updatedAlerts = await createCityAlert(alertPayload);
      setDashboard((prev) => ({
        ...prev,
        alerts: updatedAlerts,
        ...(USE_MOCK ? { operatorAlerts: updatedAlerts } : {}),
      }));
      notify('Оповещение опубликовано — жители видят его в ленте');
      if (!USE_MOCK) refreshQuietly(); // список оповещений в панели
    } catch (error) {
      redirectIfUnauthorized(error);
      throw error;
    }
  };

  // Правка оповещения или снятие с публикации; форма сама покажет ошибку
  const handleUpdateCityAlert = async (alertId, patch, successText) => {
    try {
      const result = await updateCityAlert(alertId, patch);
      if (USE_MOCK) {
        setDashboard((prev) => ({ ...prev, alerts: result, operatorAlerts: result }));
      } else {
        setDashboard((prev) => ({
          ...prev,
          operatorAlerts: prev.operatorAlerts.map((a) => (a.id === alertId ? result : a)),
        }));
        refreshQuietly(); // лента жителей
      }
      notify(successText || 'Оповещение изменено');
    } catch (error) {
      redirectIfUnauthorized(error);
      throw error;
    }
  };

  const sosRecipients = dashboard.contacts.filter((c) => c.receivesSos);

  return (
    <div className="app-root">
      {connectionError && (
        <div className="app-banner app-banner--error" role="alert">
          <span>Нет связи с сервером: данные не загружены. {connectionError}</span>
          <button
            type="button"
            onClick={() =>
              loadDashboard().catch((error) => setConnectionError(error?.message || 'Ошибка'))
            }
          >
            Повторить
          </button>
        </div>
      )}

      {notice && (
        <div
          key={notice.id}
          className={`app-toast app-toast--${notice.type}`}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          <span>{notice.text}</span>
          <button type="button" aria-label="Закрыть сообщение" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}

      {currentPage === 'register' && (
        <RegisterPage
          initialUser={dashboard.user}
          isAuthenticated={isAuthenticated && !USE_MOCK}
          canBrowse={dataLoaded}
          onSuccess={handleRegistrationSuccess}
          onGoToLogin={() => setCurrentPage('home')}
          onGoHome={() => setCurrentPage('home')}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'home' && (
        <HomePage
          user={dashboard.user}
          services={dashboard.services}
          alerts={dashboard.alerts}
          contacts={dashboard.contacts}
          canModerate={canModerate}
          onNavigate={handleNavigate}
          onTriggerSos={handleRequestSos}
          onConfirmSos={handleTriggerSos}
        />
      )}

      {currentPage === 'sos' && (
        <SosSentPage
          user={dashboard.user}
          canModerate={canModerate}
          sosWaitingTips={dashboard.sosWaitingTips}
          sosSession={sosSession}
          onCancelSos={handleCancelSos}
          onNavigate={handleNavigate}
        />
      )}

      {currentPage === 'contacts' && (
        <ContactsPage
          user={dashboard.user}
          contacts={dashboard.contacts}
          maxContacts={dashboard.maxContacts}
          canModerate={canModerate}
          onNavigate={handleNavigate}
          onTriggerSos={handleRequestSos}
          onToggleContactSos={handleToggleContactSos}
          onAddContact={handleAddContact}
          onDeleteContact={handleDeleteContact}
        />
      )}

      {currentPage === 'guides' && (
        <GuidesPage
          user={dashboard.user}
          services={dashboard.services}
          guides={dashboard.guides}
          canModerate={canModerate}
          onNavigate={handleNavigate}
          onTriggerSos={handleRequestSos}
        />
      )}

      {currentPage === 'alerts' && (
        <AlertsPage
          user={dashboard.user}
          alerts={dashboard.alerts}
          canModerate={canModerate}
          onNavigate={handleNavigate}
          onTriggerSos={handleRequestSos}
          onTogglePushNotifications={handleTogglePushNotifications}
        />
      )}

      {currentPage === 'map' && (
        <MapPage
          user={dashboard.user}
          categories={dashboard.mapCategories}
          places={dashboard.mapPlaces}
          canModerate={canModerate}
          onNavigate={handleNavigate}
          onTriggerSos={handleRequestSos}
        />
      )}

      {currentPage === 'report' && (
        <ReportPage
          user={dashboard.user}
          incidentTypes={dashboard.incidentTypes}
          reportNextSteps={dashboard.reportNextSteps}
          canModerate={canModerate}
          onSubmitReport={handleSubmitReport}
          onUploadPhotos={handleUploadPhotos}
          onNavigate={handleNavigate}
          onTriggerSos={handleRequestSos}
        />
      )}

      {currentPage === 'operator' && canModerate && (
        <OperatorPanelPage
          user={dashboard.user}
          operatorProfile={dashboard.operatorProfile}
          incidents={dashboard.operatorIncidents}
          sosSignals={dashboard.operatorSos}
          stats={dashboard.operatorStats}
          alerts={dashboard.operatorAlerts}
          onUpdateIncidentStatus={handleUpdateIncidentStatus}
          onResolveSos={handleResolveSos}
          onCreateAlert={handleCreateCityAlert}
          onUpdateAlert={handleUpdateCityAlert}
          onNavigate={handleNavigate}
        />
      )}

      {sosConfirmOpen && (
        <div
          className="app-modal"
          role="presentation"
          onKeyDown={(e) => e.key === 'Escape' && setSosConfirmOpen(false)}
        >
          <div
            className="app-modal__card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sos-confirm-title"
          >
            <h2 id="sos-confirm-title" className="app-modal__title">
              Отправить сигнал SOS?
            </h2>
            {sosRecipients.length > 0 ? (
              <p className="app-modal__text">
                {dashboard.user.hasLocation === false
                  ? 'Сообщение получат'
                  : 'Сообщение с вашим местоположением получат'}
                : <strong>{sosRecipients.map((c) => c.name).join(', ')}</strong>.{' '}
                {dashboard.user.hasLocation === false &&
                  'Ваше место пока неизвестно: если браузер его определит, координаты уйдут следом. '}
                В службу 112 сигнал не передаётся — если нужна скорая, полиция или пожарные,
                позвоните 112.
              </p>
            ) : (
              <p className="app-modal__text app-modal__text--warn">
                У вас нет контактов, которым отправляется SOS, — сигнал никому не уйдёт. Добавьте
                контакты или сразу позвоните 112.
              </p>
            )}
            <div className="app-modal__actions">
              <button
                type="button"
                className="app-modal__btn app-modal__btn--danger"
                autoFocus
                onClick={handleTriggerSos}
              >
                Отправить SOS
              </button>
              {sosRecipients.length === 0 && (
                <button
                  type="button"
                  className="app-modal__btn"
                  onClick={() => {
                    setSosConfirmOpen(false);
                    setCurrentPage('contacts');
                  }}
                >
                  Добавить контакты
                </button>
              )}
              <a className="app-modal__btn app-modal__btn--link" href="tel:112">
                Позвонить 112
              </a>
              <button
                type="button"
                className="app-modal__btn"
                onClick={() => setSosConfirmOpen(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
