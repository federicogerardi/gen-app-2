import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { appCopy } from '../../../app/copy/system';

const mocks = vi.hoisted(() => ({
  authSession: {
    session: null,
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: {
      projects: false,
      models: false,
      artifacts: false,
      sessionsList: false,
      sessionsDetail: false,
      toolsUpload: false,
    },
  },
  getSessionArtifacts: vi.fn(async () => ({
    sessionId: 'sess_demo',
    toolKey: 'funnel-pages',
    status: 'completed',
    artifacts: [
      {
        artifactId: 'a-1',
        requestId: 'r-1',
        projectId: 'p-1',
        stepKey: 'optin',
        artifactRole: 'step' as const,
        status: 'completed' as const,
        content: 'artifact content',
        updatedAt: '2026-05-09T10:00:00.000Z',
        failureReason: null,
      },
    ],
  })),
}));

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => mocks.authSession,
}));

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
    <MemoryRouter initialEntries={['/sessionsummary/sess_demo']}>
      <Routes>
        <Route path="/sessionsummary/:sessionId" element={<SessionSummaryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('SessionSummaryDetailPage', () => {
  it('renders primary/sidebar layout with session metadata and step content panel', async () => {
    const { SessionSummaryDetailPage } = await import('./SessionSummaryDetailPage');
    renderPage(SessionSummaryDetailPage);

    expect(await screen.findByTestId('session-artifact-tabs')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Project One - Hotlead Funnel' })).toHaveLength(2);
    expect(screen.getByLabelText('Preview contenuto sessione')).toBeInTheDocument();
    expect(screen.getByLabelText('Contesto sessione')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText(/sessionId: sess_demo/)).toBeInTheDocument();
    const archiveLinks = screen.getAllByRole('link', { name: appCopy.ui.actions.openSessionArchive });
    expect(archiveLinks).toHaveLength(2);
    archiveLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/sessionsummary');
    });
  });
});