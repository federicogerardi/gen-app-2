import { NavLink } from 'react-router-dom';
import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Zap,
  Map,
  Clapperboard,
  Archive,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { appCopy, appNavigation } from '../copy/system';
import { isToolEnabled } from '../../features/tools/runtime/tool-form-architecture';
import type { SupportedTool } from '../../features/tools/machines/tool-flow.machine';
import { Surface, cx, uiPrimitives } from '../ui/primitives';
import './MainNavigation.css';

type NavIcon = ComponentType<{ size: number; className?: string }>;

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
  '/tools/youtube-lf-script': Clapperboard,
  '/sessionsummary': Archive,
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
    (item) => (!('adminOnly' in item && item.adminOnly) || isAdmin)
      && (!item.to.startsWith('/tools/')
      || isToolEnabled(item.to.replace('/tools/', '') as SupportedTool)),
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

      <div className="nav-mobile-header">
        <button
          type="button"
          className={cx(uiPrimitives.menuToggle, 'nav-mobile-close')}
          onClick={onCloseMobile}
          aria-label={appCopy.ui.actions.closeNavigationMenu}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

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
