import { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuthSession } from '../providers/AuthSessionProvider';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/projects', label: 'Projects', end: true },
  { to: '/tools/funnel-pages', label: 'Funnel Pages', end: false },
  { to: '/tools/nextland', label: 'Nextland', end: false },
  { to: '/artifacts', label: 'Artifacts', end: false },
  { to: '/admin', label: 'Admin', end: false },
];

export const AuthenticatedShell = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const auth = useAuthSession();

  if (auth.loading) {
    return <main className="app-shell"><p>Verifica sessione...</p></main>;
  }

  if (!auth.session) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="app-shell app-shell-auth">
      <header className="panel auth-shell-header">
        <div>
          <h1>Generation Console</h1>
          <p>{auth.session.user.email} ({auth.session.user.role})</p>
        </div>

        <div className="auth-shell-actions">
          <span className="runtime-badge">runtime: as-is</span>
          <button type="button" className="menu-toggle" onClick={() => setMenuOpen((prev) => !prev)}>
            Menu
          </button>
          <button type="button" onClick={() => void auth.logout()}>
            Logout
          </button>
        </div>
      </header>

      <nav className={`panel main-nav ${menuOpen ? 'is-open' : ''}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </main>
  );
};
