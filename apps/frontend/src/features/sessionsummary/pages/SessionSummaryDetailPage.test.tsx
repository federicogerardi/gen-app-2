import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { appCopy } from '../../../app/copy/system';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

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

vi.mock('../../../app/runtime/queries/useArtifactDetailQuery', () => ({
  useArtifactDetailQuery: () => ({
    data: {
      artifactId: 'a-1',
      requestId: 'r-1',
      projectId: 'p-1',
      sessionId: 'sess_demo',
      stepKey: 'vsl',
      artifactRole: 'final',
      runMode: 'regenerate',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      workflowType: 'funnel_pages',
      content: 'artifact content',
      createdAt: '2026-05-09T09:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
      sourceRequest: {
        requestId: 'req-source-1',
        userId: 'user-1',
        projectId: 'p-1',
        artifactType: 'content',
        model: 'openrouter/auto',
        input: {
          notes: 'note value',
          tone: 'direct',
          briefingId: 'brief-1',
          briefingFileName: 'brief.txt',
        },
        workflowType: 'funnel_pages',
        outputFormat: 'markdown',
        toolKey: 'funnel-pages',
      },
    } satisfies GenerationArtifact,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({
    artifacts: [],
    isStreamActive: false,
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
    expect(screen.getAllByRole('heading', { name: 'Project One - Hotlead Funnel' })).toHaveLength(1);
    expect(screen.getByLabelText('Preview contenuto sessione')).toBeInTheDocument();
    expect(screen.getByLabelText('Contesto sessione')).toBeInTheDocument();
    expect(screen.getByText('Completato')).toBeInTheDocument();
    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Tool')).toBeInTheDocument();
    expect(screen.getByText('Data job')).toBeInTheDocument();
    expect(screen.getByText('Ultimo aggiornamento')).toBeInTheDocument();
    expect(screen.getByText('Artefatti')).toBeInTheDocument();
    expect(screen.getByText('Dettagli sessione')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: appCopy.ui.actions.openSessionArchive })).toHaveAttribute('href', '/sessionsummary');
    const relaunchLink = screen.getByRole('link', { name: 'Rilancia' });
    expect(relaunchLink.getAttribute('href')).toContain('/tools/funnel-pages?');
    expect(relaunchLink.getAttribute('href')).toContain('intent=regenerate');
    expect(relaunchLink.getAttribute('href')).toContain('projectId=p-1');
    expect(relaunchLink.getAttribute('href')).toContain('sourceArtifactId=a-1');
    expect(relaunchLink.getAttribute('href')).toContain('relaunchFromArtifactId=a-1');
  });
});
