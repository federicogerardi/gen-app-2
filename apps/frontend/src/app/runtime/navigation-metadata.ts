import { appCopy } from '../copy/system';

export type NavigationIconKey = 'dashboard' | 'projects' | 'tools' | 'sessions' | 'artifacts' | 'admin';

export type NavigationItem = {
  to: string;
  label: string;
  end: boolean;
  adminOnly?: boolean;
  iconKey: NavigationIconKey;
};

const NAVIGATION_ITEMS: NavigationItem[] = [
  { to: '/dashboard', label: appCopy.ui.navigation.dashboard, end: true, iconKey: 'dashboard' },
  { to: '/tools', label: appCopy.ui.navigation.tools, end: false, iconKey: 'tools' },
  { to: '/dashboard/projects', label: appCopy.ui.navigation.projects, end: true, iconKey: 'projects' },
  { to: '/sessionsummary', label: appCopy.ui.navigation.sessionSummary, end: false, iconKey: 'sessions' },
  { to: '/artifacts', label: appCopy.ui.navigation.artifacts, end: false, adminOnly: true, iconKey: 'artifacts' },
  { to: '/admin', label: appCopy.ui.navigation.admin, end: false, adminOnly: true, iconKey: 'admin' },
];

export const getMainNavigationItems = (isAdmin: boolean): NavigationItem[] => {
  return NAVIGATION_ITEMS.filter((item) => (item.adminOnly ? isAdmin : true));
};
