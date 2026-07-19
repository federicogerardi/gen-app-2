import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type * as React from 'react';
import { Link, Outlet, RouterProvider, useNavigate } from 'react-router-dom';
import { createAppRouter } from './app-router';

// Minimal stubs for route smoke tests
vi.mock('../../app/providers/AuthSessionProvider', async () => {
  const { createMockAuthSessionProvider } = await import('../../test/mocks/auth-session-provider.mock');
  return {
    ...createMockAuthSessionProvider({ role: 'admin' }),
    AuthSessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

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

vi.mock('../../features/admin/pages/AdminApiServicesPage', () => ({
  AdminApiServicesPage: () => <h1>Admin api services</h1>,
}));

vi.mock('../../features/admin/pages/AdminChangelogPage', () => ({
  AdminChangelogPage: () => <h1>Admin changelog</h1>,
}));

vi.mock('../../features/admin/pages/AdminUserReportsPage', () => ({
  AdminUserReportsPage: () => <h1>Admin user reports</h1>,
}));

vi.mock('../../features/admin/pages/AdminActivityPage', () => ({
  AdminActivityPage: () => <h1>Recent activity</h1>,
}));

vi.mock('../../features/admin/pages/AdminDashboardPage', () => ({
  AdminDashboardPage: () => <h1>Dashboard admin</h1>,
}));

vi.mock('../../features/tools/funnel-pages/pages/FunnelPagesToolPage', () => ({
  FunnelPagesToolPage: () => {
    const navigate = useNavigate();

    return (
      <button type="button" onClick={() => navigate('/admin/artifacts')}>
        View results
      </button>
    );
  },
}));

vi.mock('../../features/artifacts/pages/ArtifactsPage', () => ({
  ArtifactsPage: () => (
    <div data-testid="artifacts-listing">
      Artifacts listing loaded
      <Link to="/admin/artifacts/art-1">Open artifact detail</Link>
    </div>
  ),
}));

vi.mock('../../features/artifacts/pages/ArtifactDetailPage', () => ({
  ArtifactDetailPage: () => <div data-testid="artifact-detail-page">Artifact detail loaded</div>,
}));

vi.mock('../../features/sessionsummary/pages/SessionSummaryDetailPage', () => ({
  SessionSummaryDetailPage: () => <div data-testid="sessionsummary-detail">SessionSummary detail loaded</div>,
}));


describe('app router – integration', () => {
  beforeEach(() => {
    // createBrowserRouter reads the shared jsdom history; reset it so this
    // file does not inherit location state left by sibling tests in the same worker.
    window.history.replaceState({}, '', '/');
  });

  it('redirects /tools to /workspaces via wildcard', async () => {
    window.history.pushState({}, '', '/tools');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    await vi.waitFor(() => {
      expect(window.location.pathname).toBe('/workspaces');
    });
    router.dispose();
  });

  it('follows SPA flow tool completed -> CTA -> artifacts listing', async () => {
    window.history.pushState({}, '', '/tools/funnel-pages');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    const cta = await screen.findByRole('button', { name: /view results/i });
    cta.click();

    expect(await screen.findByTestId('artifacts-listing')).toBeInTheDocument();
    router.dispose();
  });

  it('navigates from /admin/artifacts listing item to /admin/artifacts/:id detail route', async () => {
    window.history.pushState({}, '', '/admin/artifacts');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    const openDetailLink = await screen.findByRole('link', { name: /open artifact detail/i });
    fireEvent.click(openDetailLink);

    expect(await screen.findByTestId('artifact-detail-page')).toBeInTheDocument();
    router.dispose();
  });

  it('renders session summary detail route at /workspaces/:workspaceId/sessions/:sessionId', async () => {
    window.history.pushState({}, '', '/');
    window.history.pushState({}, '', '/workspaces/proj-1/sessions/sess_demo');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByTestId('sessionsummary-detail', {}, { timeout: 3000 })).toBeInTheDocument();
    router.dispose();
  });

  it('renders the admin dashboard at /admin', async () => {
    window.history.pushState({}, '', '/admin');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: /dashboard admin/i })).toBeInTheDocument();
    router.dispose();
  });

  it('renders the admin api services page at /admin/api-services', async () => {
    window.history.pushState({}, '', '/admin/api-services');
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: /admin api services/i })).toBeInTheDocument();
    router.dispose();
  });

  it.each([
    ['/admin?lh-route=users', /admin users/i, '/admin/users'],
    ['/admin?lh-route=models', /admin models/i, '/admin/models'],
    ['/admin?lh-route=changelog', /admin changelog/i, '/admin/changelog'],
    ['/admin?lh-route=user-reports', /admin user reports/i, '/admin/user-reports'],
    ['/admin?lh-route=activity', /recent activity/i, '/admin/activity'],
  ])('resolves lighthouse seed route %s to target admin section', async (entryPath, headingName, expectedPathname) => {
    window.history.pushState({}, '', entryPath);
    const router = createAppRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: headingName })).toBeInTheDocument();
    expect(window.location.pathname).toBe(expectedPathname);
    router.dispose();
  });
});
