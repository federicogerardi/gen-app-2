import { NavLink } from 'react-router-dom';
import {
  Activity,
  Camera,
  LayoutDashboard,
  Megaphone,
  MessageSquareWarning,
  type LucideIcon,
  Settings2,
  Users,
} from 'lucide-react';
import { adminNavigationItems } from '../config/admin-navigation';
import { appCopy } from '../../../app/copy/system';
import { Surface, cx } from '../../../app/ui/primitives';

const adminNavIcons: Record<(typeof adminNavigationItems)[number]['key'], LucideIcon> = {
  overview: LayoutDashboard,
  users: Users,
  models: Settings2,
  'api-services': Settings2,
  changelog: Megaphone,
  'user-reports': MessageSquareWarning,
  activity: Activity,
  'geometric-screenshots': Camera,
};

export const AdminPersistentNavigation = () => {
  return (
      <Surface as="nav" className="ui-admin-persistent-nav" aria-label={appCopy.ui.adminNavigation.ariaLabel}>
      <div className="ui-admin-persistent-nav__list">
        {adminNavigationItems.map((item) => {
          const Icon = adminNavIcons[item.key];
          const navLinkProps = item.end !== undefined ? { end: item.end } : {};

          return (
            <NavLink
              key={item.key}
              to={item.to}
              {...navLinkProps}
              className={({ isActive }) => cx('ui-admin-persistent-nav__link', isActive && 'is-active')}
            >
              <Icon size={16} aria-hidden="true" className="ui-admin-persistent-nav__icon" />
              <span className="ui-admin-persistent-nav__label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </Surface>
  );
};