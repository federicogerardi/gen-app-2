import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { appCopy } from '../copy/system';
import { useAuthSession } from '../providers/AuthSessionProvider';
import { MainNavigation } from './MainNavigation';
import './MainNavigation.css';
import { ThemeToggleButton } from '../ui/ThemeToggleButton';
import { Shell, Surface, cx, uiPrimitives } from '../ui/primitives';

export const AuthenticatedShell = () => {
  const auth = useAuthSession();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const logMobileNavShiftDiagnostics = () => {
      const shell = document.querySelector('.ui-shell-auth');
      const header = document.querySelector('.ui-auth-header');
      const nav = document.getElementById('main-navigation');
      const hamburger = document.getElementById('mobile-nav-open-button');
      const close = document.getElementById('mobile-nav-close-button');

      if (!shell || !header || !nav || !hamburger || !close) {
        return;
      }

      const shellRect = shell.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const hamburgerRect = hamburger.getBoundingClientRect();
      const closeRect = close.getBoundingClientRect();

      const metrics = {
        state: isMobileNavOpen ? 'open' : 'closed',
        shell: { top: shellRect.top, left: shellRect.left, width: shellRect.width },
        header: { top: headerRect.top, left: headerRect.left, height: headerRect.height },
        nav: { top: navRect.top, left: navRect.left, width: navRect.width },
        hamburger: {
          top: hamburgerRect.top,
          left: hamburgerRect.left,
          centerY: hamburgerRect.top + hamburgerRect.height / 2,
          height: hamburgerRect.height,
        },
        close: {
          top: closeRect.top,
          left: closeRect.left,
          centerY: closeRect.top + closeRect.height / 2,
          height: closeRect.height,
        },
        deltas: {
          top: closeRect.top - hamburgerRect.top,
          centerY:
            closeRect.top + closeRect.height / 2 -
            (hamburgerRect.top + hamburgerRect.height / 2),
          left: closeRect.left - hamburgerRect.left,
        },
      };

      console.groupCollapsed('[mobile-nav][shift-diagnostics]');
      console.table(metrics);
      console.groupEnd();
    };

    const raf = window.requestAnimationFrame(() => {
      logMobileNavShiftDiagnostics();
    });

    window.addEventListener('resize', logMobileNavShiftDiagnostics);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', logMobileNavShiftDiagnostics);
    };
  }, [isMobileNavOpen]);

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
          <p className={uiPrimitives.metaLine}>{appCopy.editorial.header.eyebrow}</p>
          <h1>{appCopy.editorial.header.headline}</h1>
          <p>{auth.session.user.email} ({auth.session.user.role})</p>
        </div>

        <div className={uiPrimitives.authActions}>
          <ThemeToggleButton />
          <button
            type="button"
            className={cx(uiPrimitives.menuToggle, 'is-priority', isMobileNavOpen && 'is-hidden')}
            id="mobile-nav-open-button"
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
    </Shell>
  );
};
