import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { appCopy } from '../copy/system';
import { useAuthSession } from '../providers/AuthSessionProvider';
import { MainNavigation } from './MainNavigation';
import './MainNavigation.css';
import { ThemeToggleButton } from '../ui/ThemeToggleButton';
import { GlobalFeedbackViewport } from '../ui/GlobalFeedbackViewport';
import { Shell, Surface, cx, uiPrimitives } from '../ui/primitives';

export const AuthenticatedShell = () => {
  const auth = useAuthSession();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  if (auth.loading) {
    return <Shell as="main"><p>{appCopy.ui.session.verifying}</p></Shell>;
  }

  if (!auth.session) {
    return <Navigate to="/" replace />;
  }

  return (
    <Shell as="main" className={uiPrimitives.shellAuth}>
      <Surface as="header" className={uiPrimitives.authHeader}>
        <div>
          <h1>{appCopy.editorial.header.headline}</h1>
          <p>{auth.session.user.email} ({auth.session.user.role})</p>
        </div>

        <div className={uiPrimitives.authActions}>
          <ThemeToggleButton />
          <button
            type="button"
            className={cx(uiPrimitives.menuToggle, 'is-priority', isMobileNavOpen && 'is-hidden')}
            onClick={() => setIsMobileNavOpen(true)}
            aria-label={appCopy.ui.actions.openNavigationMenu}
            aria-expanded={isMobileNavOpen}
            aria-controls="main-navigation"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
        </div>
      </Surface>

      <button
        type="button"
        className={cx(uiPrimitives.mobileNavBackdrop, isMobileNavOpen && uiPrimitives.mainNavOpen)}
        onClick={() => setIsMobileNavOpen(false)}
        aria-label={appCopy.ui.actions.closeNavigationMenu}
        aria-hidden={!isMobileNavOpen}
        tabIndex={isMobileNavOpen ? 0 : -1}
      />

      <section className={cx(uiPrimitives.workbench, isNavCollapsed && 'is-nav-collapsed')}>
        <MainNavigation
          isCollapsed={isNavCollapsed}
          isMobileOpen={isMobileNavOpen}
          isAdmin={auth.session.user.role === 'admin'}
          onToggleCollapsed={() => setIsNavCollapsed((prev) => !prev)}
          onCloseMobile={() => setIsMobileNavOpen(false)}
          onLogout={() => void auth.logout()}
        />

        <section className={uiPrimitives.mainCanvas}>
          <Outlet />
        </section>
      </section>

      <GlobalFeedbackViewport />
    </Shell>
  );
};
