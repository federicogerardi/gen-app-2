import { useState } from 'react';
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
} from 'lucide-react';
import { appNavigation } from '../copy/system';
import { Surface, cx, uiPrimitives } from '../ui/primitives';
import './MainNavigation.css';

type NavIcon = React.ComponentType<{ size: number; className?: string }>;

const navIcons: Record<string, NavIcon> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/projects': FolderOpen,
  '/tools/funnel-pages': Zap,
  '/tools/nextland': Map,
  '/artifacts': Archive,
  '/admin': Settings,
};

export const MainNavigation = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <Surface as="nav" className={cx(uiPrimitives.mainNav, isCollapsed && 'is-collapsed')}>
      <button
        type="button"
        className="nav-toggle"
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="nav-items">
        {appNavigation.map((item) => {
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
              title={item.label}
            >
              <Icon size={18} className="nav-icon" />
              {!isCollapsed && <span className="nav-label">{item.label}</span>}
            </NavLink>
          );
        })}
      </div>
    </Surface>
  );
};
