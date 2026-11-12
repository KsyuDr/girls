import { createContext, useContext } from 'react';
import {
  Home,
  Bell,
  Map,
  TriangleAlert,
  Users,
  BookOpen,
  ClipboardList,
  Siren,
} from 'lucide-react';

/**
 * Общие данные оболочки (меню, профиль, выход) для всех страниц.
 * Страницы не передают их через пропсы: меню одинаковое везде, поэтому не «скачет»
 * между режимами жителя и модератора.
 */
export const ShellContext = createContext({
  user: null,
  isAuthenticated: false,
  canModerate: false,
  currentPage: 'home',
  moderation: { newIncidents: 0, activeSos: 0 },
  onNavigate: () => {},
  onTriggerSos: () => {},
  onLogout: () => {},
  onNotify: () => {},
});

export function useShell() {
  return useContext(ShellContext);
}

export const RESIDENT_NAV = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'alerts', label: 'Оповещения', icon: Bell },
  { id: 'map', label: 'Карта', icon: Map },
  { id: 'report', label: 'Сообщить', icon: TriangleAlert },
  { id: 'contacts', label: 'Контакты', icon: Users },
  { id: 'guides', label: 'Службы и памятки', icon: BookOpen },
];

export const MODERATOR_NAV = [
  { id: 'operator', label: 'Обращения', icon: ClipboardList, badge: 'newIncidents' },
  { id: 'operator-sos', label: 'SOS-сигналы', icon: Siren, badge: 'activeSos', danger: true },
];
