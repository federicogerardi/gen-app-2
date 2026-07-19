import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { DashboardPage } from './DashboardPage';

const sessionsQueryState = vi.hoisted(() => ({
  data: [] as Array<{ sessionId: string; projectId: string; toolKey: string | null; createdAt?: string; updatedAt: string }>,
  loading: false,
  error: null as string | null,
}));

const projectsQueryState = vi.hoisted(() => ({
  data: [{ id: 'p1', name: 'Project One', description: '', updatedAt: '2026-05-12T10:00:00.000Z' }],
  loading: false,
  error: null as string | null,
}));

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { email: 'u@test.com', role: 'member' } },
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: { projects: false, models: false, artifacts: false, toolsUpload: false, sessionsList: true },
  }),
  useAuthState: () => ({
    session: { user: { email: 'u@test.com', role: 'member' } },
    loading: false,
    hasError: false,
  }),
  useAuthActions: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    clearError: () => {},
  }),
  useApiConfig: () => ({
    apiBaseUrl: '',
    capabilities: { projects: false, models: false, artifacts: false, toolsUpload: false, sessionsList: true },
  }),
  useOAuthUrl: () => ({
    oauthStartUrl: '',
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({ artifacts: [], isStreamActive: false }),
}));

vi.mock('../../../app/runtime/queries/useProjectsQuery', () => ({
  useProjectsQuery: () => projectsQueryState,
}));

vi.mock('../../../app/runtime/queries/useSessionsQuery', () => ({
  useSessionsQuery: () => sessionsQueryState,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    sessionsQueryState.data = [];
    sessionsQueryState.loading = false;
    sessionsQueryState.error = null;
    projectsQueryState.data = [{ id: 'p1', name: 'Project One', description: '', updatedAt: '2026-05-12T10:00:00.000Z' }];
    projectsQueryState.loading = false;
    projectsQueryState.error = null;
  });

  it('renders dashboard heading', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: appCopy.editorial.dashboard.headline })).toBeInTheDocument();
  });

  it('renders shortcut links to tools', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    const toolsLinks = screen.getAllByRole('link', { name: appCopy.ui.navigation.tools });

    expect(toolsLinks.length).toBeGreaterThan(0);
    expect(toolsLinks[0]).toHaveAttribute('href', '/workspaces');
  });

  it('shows empty state when no recent sessions', () => {
    sessionsQueryState.data = [];
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(appCopy.editorial.sessions.emptyState)).toBeInTheDocument();
  });

  it('renders recent sessions with project, tool, and creation date', () => {
    sessionsQueryState.data = [
      {
        sessionId: 'sess-1',
        projectId: 'p1',
        toolKey: 'funnel-pages',
        createdAt: '2026-05-12T10:00:00.000Z',
        updatedAt: '2026-05-12T10:00:00.000Z',
      },
    ];

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText(appCopy.editorial.dashboard.cards.recentSessions.title)).toBeInTheDocument();
    expect(screen.getByText(/Project One/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Hotlead Funnel/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Project One.*Hotlead Funnel/i)).toBeInTheDocument();
  });
});
