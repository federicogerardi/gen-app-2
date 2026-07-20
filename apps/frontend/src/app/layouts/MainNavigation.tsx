import { NavLink } from 'react-router-dom';
import { useCallback, useEffect, useRef, type ComponentType } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Archive,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { appCopy } from '../copy/system';
import { getMainNavigationItems, type NavigationIconKey } from '../runtime/navigation-metadata';
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

const navIcons: Record<NavigationIconKey, NavIcon> = {
  dashboard: LayoutDashboard,
  projects: FolderOpen,
  workspaces: FolderOpen,
  sessions: Archive,
  artifacts: Archive,
  admin: Settings,
};

export const MainNavigation = ({
  isCollapsed,
  isMobileOpen,
  isAdmin,
  onToggleCollapsed,
  onCloseMobile,
  onLogout,
}: MainNavigationProps) => {
  const visibleItems = getMainNavigationItems(isAdmin);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap: when mobile nav opens, focus first nav item; save previous focus
  useEffect(() => {
    if (isMobileOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      const navElement = document.getElementById('main-navigation');
      const firstFocusable = navElement?.querySelector<HTMLElement>(
        'a, button:not([disabled])',
      );
      firstFocusable?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isMobileOpen]);

  // Escape key handler to close mobile nav
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileOpen) {
        onCloseMobile();
      }
    },
    [isMobileOpen, onCloseMobile],
  );

  return (
    <Surface
      as="nav"
      id="main-navigation"
      className={cx(uiPrimitives.mainNav, isCollapsed && !isMobileOpen && 'is-collapsed', isMobileOpen && uiPrimitives.mainNavOpen)}
      onKeyDown={handleKeyDown}
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
          const Icon = navIcons[item.iconKey] || LayoutDashboard;
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
