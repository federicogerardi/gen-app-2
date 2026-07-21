import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { DashboardPage } from './DashboardPage';

const projectsQueryState = vi.hoisted(() => ({
  data: [{ id: 'p1', name: 'Project One', description: '', updatedAt: '2026-05-12T10:00:00.000Z' }],
  loading: false,
  error: null as string | null,
}));

const dashboardOverviewState = vi.hoisted(() => ({
  loading: false,
  error: null as string | null,
  resumeCandidate: null as {
    workspaceId: string;
    workspaceName: string;
    toolKey: string;
    toolLabel: string;
    sessionId: string;
  } | null,
  foundationSummary: [] as Array<{
    toolKey: string;
    label: string;
    workspacesWithAsset: number;
    totalWorkspaces: number;
  }>,
  recommendations: [] as Array<{
    toolKey: string;
    label: string;
    to: string;
    reason: string;
    workspaceId: string;
    workspaceName: string;
    priorityScore: number;
  }>,
  recentSessions: [] as Array<{
    sessionId: string;
    projectId: string;
    toolKey: string | null;
    status: string;
    artifactCount: number;
    updatedAt: string;
  }>,
  activeWorkspaces: [] as Array<{
    id: string;
    name: string;
    qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked';
  }>,
  mostGappedWorkspaceId: null as string | null,
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

vi.mock('../runtime/useDashboardOverview', () => ({
  useDashboardOverview: () => dashboardOverviewState,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    projectsQueryState.data = [{ id: 'p1', name: 'Project One', description: '', updatedAt: '2026-05-12T10:00:00.000Z' }];
    projectsQueryState.loading = false;
    projectsQueryState.error = null;
    dashboardOverviewState.loading = false;
    dashboardOverviewState.error = null;
    dashboardOverviewState.resumeCandidate = null;
    dashboardOverviewState.foundationSummary = [];
    dashboardOverviewState.recommendations = [];
    dashboardOverviewState.recentSessions = [];
    dashboardOverviewState.activeWorkspaces = [];
    dashboardOverviewState.mostGappedWorkspaceId = null;
  });

  it('shows zero state when no projects', () => {
    projectsQueryState.data = [];
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(appCopy.editorial.dashboard.zeroState.headline)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: appCopy.editorial.dashboard.zeroState.cta })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    dashboardOverviewState.loading = true;
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(appCopy.ui.states.loadingDashboard)).toBeInTheDocument();
  });

  it('shows hero with choose-a-workspace CTA when no resume candidate', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(appCopy.editorial.dashboard.heroHeadlineChoose)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: appCopy.editorial.dashboard.heroCtaChoose })).toHaveAttribute('href', '/workspaces');
  });

  it('shows hero with resume CTA when resumeCandidate is present', () => {
    dashboardOverviewState.resumeCandidate = {
      workspaceId: 'p1',
      workspaceName: 'Project One',
      toolKey: 'funnel-pages',
      toolLabel: 'Hotlead Funnel',
      sessionId: 'sess-1',
    };
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(appCopy.editorial.dashboard.heroHeadlineResume('Hotlead Funnel'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: appCopy.editorial.dashboard.heroCtaResume('Hotlead Funnel') })).toHaveAttribute('href', '/workspaces/p1/tools/funnel-pages');
  });

  it('shows foundation summary with fractions', () => {
    dashboardOverviewState.foundationSummary = [
      { toolKey: 'brief-generator', label: 'Brief', workspacesWithAsset: 1, totalWorkspaces: 1 },
      { toolKey: 'tov-generator', label: 'Brand Voice', workspacesWithAsset: 0, totalWorkspaces: 1 },
      { toolKey: 'personas-generator', label: 'Personas', workspacesWithAsset: 0, totalWorkspaces: 1 },
    ];
    dashboardOverviewState.mostGappedWorkspaceId = 'p1';
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(appCopy.ui.dashboard.foundationSummaryTitle)).toBeInTheDocument();
    expect(screen.getByText('1/1 workspaces')).toBeInTheDocument();
    expect(screen.getAllByText('0/1 workspaces').length).toBeGreaterThanOrEqual(1);
  });

  it('shows recommended actions', () => {
    dashboardOverviewState.recommendations = [
      { toolKey: 'funnel-pages', label: 'Hotlead Funnel', to: '/workspaces/p1/tools/funnel-pages', reason: 'Ready', workspaceId: 'p1', workspaceName: 'Project One', priorityScore: 80 },
    ];
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(appCopy.ui.dashboard.recommendedActionsTitle)).toBeInTheDocument();
    expect(screen.getByText('Hotlead Funnel')).toBeInTheDocument();
  });

  it('shows active workspaces', () => {
    dashboardOverviewState.activeWorkspaces = [
      { id: 'p1', name: 'Project One', qualityGateStatus: 'healthy' },
    ];
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(appCopy.ui.dashboard.activeWorkspacesTitle)).toBeInTheDocument();
    expect(screen.getByText(/Project One/)).toBeInTheDocument();
  });
});
