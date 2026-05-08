import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { SessionSummaryDetailPage } from './SessionSummaryDetailPage';

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
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
  }),
}));

vi.mock('../../tools/runtime/session-client', () => ({
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
        artifactRole: 'step',
        status: 'completed',
        content: 'artifact content',
        updatedAt: '2026-05-09T10:00:00.000Z',
        failureReason: null,
      },
    ],
  })),
}));

vi.mock('../../generation/ui/SessionArtifactTabs', () => ({
  SessionArtifactTabs: () => <div data-testid="session-artifact-tabs">SessionArtifactTabs</div>,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/sessionsummary/sess_demo']}>
      <Routes>
        <Route path="/sessionsummary/:sessionId" element={<SessionSummaryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('SessionSummaryDetailPage', () => {
  it('renders primary/sidebar layout with session metadata and step content panel', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: appCopy.editorial.sessions.detailTitle })).toBeInTheDocument();
    expect(screen.getByLabelText('Preview contenuto sessione')).toBeInTheDocument();
    expect(screen.getByLabelText('Contesto sessione')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText(/sessionId: sess_demo/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: appCopy.ui.actions.openSessionArchive })).toHaveAttribute('href', '/sessionsummary');
    expect(screen.getByTestId('session-artifact-tabs')).toBeInTheDocument();
  });
});