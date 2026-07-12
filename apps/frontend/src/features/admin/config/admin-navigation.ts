import { appCopy } from '../../../app/copy/system';

export type AdminNavigationItem = {
  key: 'overview' | 'users' | 'models' | 'api-services' | 'changelog' | 'user-reports' | 'activity';
  to: '/admin' | '/admin/users' | '/admin/models' | '/admin/api-services' | '/admin/changelog' | '/admin/user-reports' | '/admin/activity';
  label: string;
  description: string;
  end?: boolean;
};

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  {
    key: 'overview',
    to: '/admin',
    label: appCopy.ui.adminNavigation.overviewLabel,
    description: appCopy.ui.adminNavigation.overviewDescription,
    end: true,
  },
  {
    key: 'users',
    to: '/admin/users',
    label: appCopy.ui.adminNavigation.usersLabel,
    description: appCopy.ui.adminNavigation.usersDescription,
  },
  {
    key: 'models',
    to: '/admin/models',
    label: appCopy.ui.adminNavigation.modelsLabel,
    description: appCopy.ui.adminNavigation.modelsDescription,
  },
  {
    key: 'api-services',
    to: '/admin/api-services',
    label: appCopy.ui.adminNavigation.apiServicesLabel,
    description: appCopy.ui.adminNavigation.apiServicesDescription,
  },
  {
    key: 'changelog',
    to: '/admin/changelog',
    label: appCopy.ui.adminNavigation.changelogLabel,
    description: appCopy.ui.adminNavigation.changelogDescription,
  },
  {
    key: 'user-reports',
    to: '/admin/user-reports',
    label: appCopy.ui.adminNavigation.userReportsLabel,
    description: appCopy.ui.adminNavigation.userReportsDescription,
  },
  {
    key: 'activity',
    to: '/admin/activity',
    label: appCopy.ui.adminNavigation.activityLabel,
    description: appCopy.ui.adminNavigation.activityDescription,
  },
] as const;