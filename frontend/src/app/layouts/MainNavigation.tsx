import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Zap,
  Map,
  Archive,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { appCopy, appNavigation } from '../copy/system';
import { Surface, cx, uiPrimitives } from '../ui/primitives';
import './MainNavigation.css';

type NavIcon = React.ComponentType<{ size: number; className?: string }>;

type MainNavigationProps = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  isAdmin: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onLogout: () => void;
};

const navIcons: Record<string, NavIcon> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/projects': FolderOpen,
  '/tools/funnel-pages': Zap,
  '/tools/nextland': Map,
  '/artifacts': Archive,
  '/admin': Settings,
};

export const MainNavigation = ({
  isCollapsed,
  isMobileOpen,
  isAdmin,
  onToggleCollapsed,
  onCloseMobile,
  onLogout,
}: MainNavigationProps) => {
  const visibleItems = appNavigation.filter(
    (item) => !('adminOnly' in item && item.adminOnly) || isAdmin,
  );

  return (
    <Surface
      as="nav"
      id="main-navigation"
      className={cx(uiPrimitives.mainNav, isCollapsed && !isMobileOpen && 'is-collapsed', isMobileOpen && uiPrimitives.mainNavOpen)}
    >
      <button
        type="button"
        className="nav-toggle"
        onClick={onToggleCollapsed}
        aria-label={isCollapsed ? appCopy.ui.actions.expandNavigation : appCopy.ui.actions.collapseNavigation}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="nav-items">
        {visibleItems.map((item) => {
          const Icon = navIcons[item.to] || LayoutDashboard;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx(
                uiPrimitives.navLink,
                isActive && uiPrimitives.navLinkActive,
                'nav-item',
              )}
              onClick={onCloseMobile}
              title={item.label}
            >
              <Icon size={18} className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          );
        })}

        <hr className="nav-divider" aria-hidden="true" />

        <button
          type="button"
          className="nav-item"
          onClick={() => {
            onCloseMobile();
            onLogout();
          }}
          aria-label={appCopy.ui.actions.logout}
          title={appCopy.ui.actions.logout}
        >
          <LogOut size={18} className="nav-icon" />
          <span className="nav-label">{appCopy.ui.actions.logout}</span>
        </button>
      </div>
    </Surface>
  );
};
