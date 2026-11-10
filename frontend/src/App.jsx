import { useState, useEffect } from 'react';
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
  getDashboardData,
  sendSosSignal,
  cancelSosSignal,
  toggleContactSos,
  addEmergencyContact,
  deleteEmergencyContact,
  togglePushNotifications,
  submitIncidentReport,
  updateIncidentStatus,
  createCityAlert,
} from './services/api';
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

function App() {
  // 'register' | 'home' | 'sos' | 'contacts' | 'guides' | 'alerts' | 'map' | 'report' | 'operator'
  const [currentPage, setCurrentPage] = useState('register');
  const [sosSession, setSosSession] = useState(null);
  const [dashboard, setDashboard] = useState({
    user: INITIAL_USER,
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
    operatorProfile: OPERATOR_PROFILE,
  });

  useEffect(() => {
    getDashboardData().then((data) => {
      setDashboard((prev) => ({
        ...prev,
        ...data,
      }));
    });
  }, []);

  const handleRegistrationSuccess = (updatedUser) => {
    setDashboard((prev) => ({
      ...prev,
      user: updatedUser,
    }));
    setCurrentPage('home');
  };

  const handleNavigate = (page) => {
    if (page === 'sos-sent' || page === 'sos') {
      setCurrentPage('sos');
      return;
    }
    setCurrentPage(page);
  };

  const handleTriggerSos = async () => {
    const session = await sendSosSignal({
      coordinates: dashboard.user.coordinates,
      address: dashboard.user.address,
    });
    setSosSession(session);
    setCurrentPage('sos');
  };

  const handleCancelSos = async () => {
    if (sosSession?.id) {
      await cancelSosSignal(sosSession.id);
    }
    setSosSession(null);
    setCurrentPage('home');
  };

  const handleToggleContactSos = async (contactId, nextReceivesSos) => {
    const updatedContacts = await toggleContactSos(contactId, nextReceivesSos);
    setDashboard((prev) => ({
      ...prev,
      contacts: updatedContacts,
    }));
  };

  const handleAddContact = async (contactPayload) => {
    const updatedContacts = await addEmergencyContact(contactPayload);
    setDashboard((prev) => ({
      ...prev,
      contacts: updatedContacts,
    }));
  };

  const handleDeleteContact = async (contactId) => {
    const updatedContacts = await deleteEmergencyContact(contactId);
    setDashboard((prev) => ({
      ...prev,
      contacts: updatedContacts,
    }));
  };

  const handleTogglePushNotifications = async (enabled) => {
    const updatedUser = await togglePushNotifications(enabled);
    setDashboard((prev) => ({
      ...prev,
      user: updatedUser,
    }));
  };

  const handleSubmitReport = async (payload) => {
    const result = await submitIncidentReport(payload);
    if (result?.incidents) {
      setDashboard((prev) => ({
        ...prev,
        operatorIncidents: result.incidents,
      }));
    }
    return result;
  };

  const handleUpdateIncidentStatus = async (incidentId, nextStatus, assignedService) => {
    const updatedIncidents = await updateIncidentStatus(incidentId, nextStatus, assignedService);
    setDashboard((prev) => ({
      ...prev,
      operatorIncidents: updatedIncidents,
    }));
  };

  const handleCreateCityAlert = async (alertPayload) => {
    const updatedAlerts = await createCityAlert(alertPayload);
    setDashboard((prev) => ({
      ...prev,
      alerts: updatedAlerts,
    }));
  };

  return (
    <div className="app-root">
      {currentPage === 'register' && (
        <RegisterPage
          initialUser={dashboard.user}
          onSuccess={handleRegistrationSuccess}
          onGoToLogin={() => setCurrentPage('home')}
        />
      )}

      {currentPage === 'home' && (
        <HomePage
          user={dashboard.user}
          services={dashboard.services}
          alerts={dashboard.alerts}
          contacts={dashboard.contacts}
          onNavigate={handleNavigate}
          onTriggerSos={handleTriggerSos}
        />
      )}

      {currentPage === 'sos' && (
        <SosSentPage
          user={dashboard.user}
          contacts={dashboard.contacts}
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
          onNavigate={handleNavigate}
          onTriggerSos={handleTriggerSos}
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
          onNavigate={handleNavigate}
          onTriggerSos={handleTriggerSos}
        />
      )}

      {currentPage === 'alerts' && (
        <AlertsPage
          user={dashboard.user}
          alerts={dashboard.alerts}
          onNavigate={handleNavigate}
          onTriggerSos={handleTriggerSos}
          onTogglePushNotifications={handleTogglePushNotifications}
        />
      )}

      {currentPage === 'map' && (
        <MapPage
          user={dashboard.user}
          categories={dashboard.mapCategories}
          places={dashboard.mapPlaces}
          onNavigate={handleNavigate}
          onTriggerSos={handleTriggerSos}
        />
      )}

      {currentPage === 'report' && (
        <ReportPage
          user={dashboard.user}
          incidentTypes={dashboard.incidentTypes}
          reportNextSteps={dashboard.reportNextSteps}
          onSubmitReport={handleSubmitReport}
          onNavigate={handleNavigate}
          onTriggerSos={handleTriggerSos}
        />
      )}

      {currentPage === 'operator' && (
        <OperatorPanelPage
          user={dashboard.user}
          operatorProfile={dashboard.operatorProfile}
          incidents={dashboard.operatorIncidents}
          onUpdateIncidentStatus={handleUpdateIncidentStatus}
          onCreateAlert={handleCreateCityAlert}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}

export default App;
