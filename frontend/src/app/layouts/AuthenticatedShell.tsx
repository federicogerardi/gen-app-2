import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { appCopy } from '../copy/system';
import { useAuthSession } from '../providers/AuthSessionProvider';
import { MainNavigation } from './MainNavigation';
import './MainNavigation.css';
import { ThemeToggleButton } from '../ui/ThemeToggleButton';
import { Button, Shell, Surface, cx, uiPrimitives } from '../ui/primitives';

export const AuthenticatedShell = () => {
  const auth = useAuthSession();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

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
          <span className={uiPrimitives.runtimeBadge}>{appCopy.ui.badges.runtimeAsIs}</span>
          <ThemeToggleButton />
          <Button type="button" onClick={() => void auth.logout()}>
            {appCopy.ui.actions.logout}
          </Button>
        </div>
      </Surface>

      <section className={cx(uiPrimitives.workbench, isNavCollapsed && 'is-nav-collapsed')}>
        <MainNavigation
          isCollapsed={isNavCollapsed}
          onToggleCollapsed={() => setIsNavCollapsed((prev) => !prev)}
        />

        <section className={uiPrimitives.mainCanvas}>
          <Outlet />
        </section>
      </section>
    </Shell>
  );
};
