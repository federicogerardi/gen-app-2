import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { appCopy } from '../../../app/copy/system';
import type { SessionArtifactGroup } from '../../tools/runtime/session-client';

const mocks = vi.hoisted(() => ({
  sessionGroup: {
    sessionId: 'sess_demo',
    toolKey: 'funnel-pages',
    status: 'completed',
    artifacts: [
      {
        artifactId: 'a-1',
        requestId: 'r-1',
        projectId: 'p-1',
        stepKey: 'optin',
        artifactRole: 'step',
        runMode: 'regenerate',
        workflowType: 'funnel_pages',
        toolKey: 'funnel-pages',
        status: 'completed',
        content: 'artifact content',
        updatedAt: '2026-05-09T10:00:00.000Z',
        failureReason: null,
      },
    ],
  } as SessionArtifactGroup,
  getSessionArtifacts: vi.fn(async () => mocks.sessionGroup),
}));

vi.mock('../../../app/providers/AuthSessionProvider', async () => {
  const { createMockAuthSessionProvider } = await import('../../../test/mocks/auth-session-provider.mock');
  return createMockAuthSessionProvider({ session: null, capabilities: { projects: false, models: false, artifacts: false, sessionsList: false, sessionsDetail: false, toolsUpload: false } });
});

vi.mock('../../../app/runtime/queries/useProjectsQuery', () => ({
  useProjectsQuery: () => ({
    data: [{ id: 'p-1', name: 'Project One', description: '', updatedAt: '2026-05-09T10:00:00.000Z' }],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../../tools/runtime/session-client', () => ({
  getSessionArtifacts: mocks.getSessionArtifacts,
}));

vi.mock('../../generation/ui/SessionArtifactTabs', () => ({
  SessionArtifactTabs: () => <div data-testid="session-artifact-tabs">SessionArtifactTabs</div>,
}));

const renderPage = (SessionSummaryDetailPage: () => ReactElement) =>
  render(
    <MemoryRouter initialEntries={['/workspaces/p-1/sessions/sess_demo']}>
      <Routes>
        <Route path="/workspaces/:workspaceId/sessions/:sessionId" element={<SessionSummaryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('SessionSummaryDetailPage', () => {
  it('renders meta-ads canonical label in title', async () => {
    const { SessionSummaryDetailPage } = await import('./SessionSummaryDetailPage');

    mocks.sessionGroup = {
      sessionId: 'sess_meta_ads',
      toolKey: 'meta-ads',
      status: 'completed',
      artifacts: [
        {
          artifactId: 'a-meta-context',
          requestId: 'r-meta-context',
          projectId: 'p-1',
          stepKey: 'context-generation',
          artifactRole: 'step',
          status: 'completed',
          content: 'meta context artifact',
          updatedAt: '2026-05-09T10:00:00.000Z',
          failureReason: null,
          workflowType: 'meta_ads_generator',
          toolKey: 'meta-ads',
          runMode: 'regenerate',
        },
      ],
    };

    renderPage(SessionSummaryDetailPage);

    expect(await screen.findByTestId('session-artifact-tabs')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Project One - MetaAds Generator' })).toBeInTheDocument();
  });

  it('renders angle-generator label in title/details and never falls back to unavailable tool copy', async () => {
    const { SessionSummaryDetailPage } = await import('./SessionSummaryDetailPage');

    mocks.sessionGroup = {
      sessionId: 'sess_demo',
      toolKey: 'angle_generator',
      status: 'completed',
      artifacts: [
        {
          artifactId: 'a-angle-step',
          requestId: 'r-angle-step',
          projectId: 'p-1',
          stepKey: 'context-and-angle-matrix',
          artifactRole: 'step',
          status: 'completed',
          content: 'angle step content',
          updatedAt: '2026-05-09T10:00:00.000Z',
          failureReason: null,
          workflowType: 'angle_generator',
          toolKey: 'angle-generator',
          runMode: 'regenerate',
        },
      ],
    };

    renderPage(SessionSummaryDetailPage);

    expect(await screen.findByTestId('session-artifact-tabs')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Project One - Angle Generator' })).toBeInTheDocument();
    expect(screen.getAllByText('Angle Generator').length).toBeGreaterThan(0);
    expect(screen.queryByText('Tool unavailable')).not.toBeInTheDocument();
  });

  it('renders primary/sidebar layout with session metadata and step content panel', async () => {
    const { SessionSummaryDetailPage } = await import('./SessionSummaryDetailPage');

    mocks.sessionGroup = {
      sessionId: 'sess_demo',
      toolKey: 'funnel-pages',
      status: 'completed',
      artifacts: [
        {
          artifactId: 'a-1',
          requestId: 'r-1',
          projectId: 'p-1',
          stepKey: 'optin',
          artifactRole: 'step',
          status: 'completed',
          content: 'artifact content',
          updatedAt: '2026-05-09T10:00:00.000Z',
          failureReason: null,
          workflowType: 'funnel_pages',
          toolKey: 'funnel-pages',
          runMode: 'regenerate',
        },
      ],
    };

    renderPage(SessionSummaryDetailPage);

    expect(await screen.findByTestId('session-artifact-tabs')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Project One - Hotlead Funnel' })).toHaveLength(1);
    expect(screen.getAllByLabelText(appCopy.ui.sessions.detail.primaryPanelAriaLabel)).toHaveLength(1);
    expect(screen.getAllByLabelText(appCopy.ui.sessions.detail.secondaryPanelAriaLabel)).toHaveLength(1);
    expect(screen.getByLabelText(appCopy.ui.sessions.detail.overviewAriaLabel)).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Tool')).toBeInTheDocument();
    expect(screen.getByText('Job date')).toBeInTheDocument();
    expect(screen.getByText('Last update')).toBeInTheDocument();
    expect(screen.getByText('Artifacts')).toBeInTheDocument();
    expect(screen.getByText('Session details')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: appCopy.ui.actions.openSessionArchive })).toHaveAttribute('href', '/workspaces/p-1/sessions');
  });

  it('does not render a relaunch CTA', async () => {
    const { SessionSummaryDetailPage } = await import('./SessionSummaryDetailPage');

    renderPage(SessionSummaryDetailPage);

    expect(await screen.findByTestId('session-artifact-tabs')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: appCopy.ui.actions.relaunchPrimary })).not.toBeInTheDocument();
  });
});