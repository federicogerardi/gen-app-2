import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type * as React from 'react';
import { Link, Outlet, RouterProvider, useNavigate } from 'react-router-dom';
import { createAppRouter } from './app-router';

// Minimal stubs for route smoke tests
vi.mock('../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: null,
    loading: false,
    error: null,
    apiBaseUrl: '',
    oauthStartUrl: '',
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
  AuthSessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../app/providers/FeedbackMessageProvider', () => ({
  useFeedbackMessage: () => ({
    messages: [],
    publishSuccess: vi.fn(),
    publishError: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

vi.mock('../../features/generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({ artifacts: [], isStreamActive: false }),
  GenerationWorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../layouts/AuthenticatedShell', () => ({
  AuthenticatedShell: () => <Outlet />,
}));

vi.mock('../layouts/PublicShell', () => ({
  PublicShell: () => <div data-testid="public-shell">public</div>,
}));

vi.mock('../../features/admin/routing/admin-guard', () => ({
  AdminGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../features/admin/pages/AdminUsersPage', () => ({
  AdminUsersPage: () => <h1>Admin users</h1>,
}));

vi.mock('../../features/admin/pages/AdminModelsPage', () => ({
  AdminModelsPage: () => <h1>Admin models</h1>,
}));

vi.mock('../../features/admin/pages/AdminChangelogPage', () => ({
  AdminChangelogPage: () => <h1>Admin changelog</h1>,
}));

vi.mock('../../features/admin/pages/AdminUserReportsPage', () => ({
  AdminUserReportsPage: () => <h1>Admin user reports</h1>,
}));

vi.mock('../../features/admin/pages/AdminActivityPage', () => ({
  AdminActivityPage: () => <h1>Attività recente</h1>,
}));

vi.mock('../../features/admin/pages/AdminDashboardPage', () => ({
  AdminDashboardPage: () => <h1>Dashboard admin</h1>,
}));

vi.mock('../../features/tools/funnel-pages/pages/FunnelPagesToolPage', () => ({
  FunnelPagesToolPage: () => {
    const navigate = useNavigate();

    return (
      <button type="button" onClick={() => navigate('/artifacts')}>
        Visualizza i risultati
      </button>
    );
  },
}));

vi.mock('../../features/tools/pages/ToolsHubPage', () => ({
  ToolsHubPage: () => <h1>Tools hub</h1>,
}));

vi.mock('../../features/artifacts/pages/ArtifactsPage', () => ({
  ArtifactsPage: () => (
    <div data-testid="artifacts-listing">
      Artifacts listing loaded
      <Link to="/artifacts/art-1">Apri dettaglio artifact</Link>
    </div>
  ),
}));

vi.mock('../../features/artifacts/pages/ArtifactDetailPage', () => ({
  ArtifactDetailPage: () => <div data-testid="artifact-detail-page">Artifact detail loaded</div>,
}));

vi.mock('../../features/sessionsummary/pages/SessionSummaryListPage', () => ({
  SessionSummaryListPage: () => <div data-testid="sessionsummary-list">SessionSummary list loaded</div>,
}));

vi.mock('../../features/sessionsummary/pages/SessionSummaryDetailPage', () => ({
  SessionSummaryDetailPage: () => <div data-testid="sessionsummary-detail">SessionSummary detail loaded</div>,
}));


describe('app router – integration', () => {
  it('renders tools hub route at /tools', async () => {
    window.history.pushState({}, '', '/tools');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: /tools hub/i })).toBeInTheDocument();
    router.dispose();
  });

  it('redirects /tools/console to /tools hub', async () => {
    window.history.pushState({}, '', '/tools/console');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: /tools hub/i })).toBeInTheDocument();
    router.dispose();
  });

  it('follows SPA flow tool completed -> CTA -> artifacts listing', async () => {
    window.history.pushState({}, '', '/tools/funnel-pages');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    const cta = await screen.findByRole('button', { name: /visualizza i risultati/i });
    cta.click();

    expect(await screen.findByTestId('artifacts-listing')).toBeInTheDocument();
    router.dispose();
  });

  it('navigates from /artifacts listing item to /artifacts/:id detail route', async () => {
    window.history.pushState({}, '', '/artifacts');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    const openDetailLink = await screen.findByRole('link', { name: /apri dettaglio artifact/i });
    fireEvent.click(openDetailLink);

    expect(await screen.findByTestId('artifact-detail-page')).toBeInTheDocument();
    router.dispose();
  });

  it('renders session summary detail route at /sessionsummary/:sessionId', async () => {
    window.history.pushState({}, '', '/sessionsummary/sess_demo');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByTestId('sessionsummary-detail')).toBeInTheDocument();
    router.dispose();
  });

  it('renders the admin dashboard at /admin', async () => {
    window.history.pushState({}, '', '/admin');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: /dashboard admin/i })).toBeInTheDocument();
    router.dispose();
  });

  it.each([
    ['/admin?lh-route=users', /admin users/i, '/admin/users'],
    ['/admin?lh-route=models', /admin models/i, '/admin/models'],
    ['/admin?lh-route=changelog', /admin changelog/i, '/admin/changelog'],
    ['/admin?lh-route=user-reports', /admin user reports/i, '/admin/user-reports'],
    ['/admin?lh-route=activity', /attività recente/i, '/admin/activity'],
  ])('resolves lighthouse seed route %s to target admin section', async (entryPath, headingName, expectedPathname) => {
    window.history.pushState({}, '', entryPath);
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: headingName })).toBeInTheDocument();
    expect(window.location.pathname).toBe(expectedPathname);
    router.dispose();
  });
});
