import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { appCopy } from '../../../app/copy/system';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import type { SessionArtifactGroup } from '../../tools/runtime/session-client';

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
  relaunchArtifact: {
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
        tone: 'Formal',
        briefingId: 'brief-1',
        briefingFileName: 'brief.txt',
      },
      workflowType: 'funnel_pages',
      outputFormat: 'markdown',
      toolKey: 'funnel-pages',
    },
  } as GenerationArtifact,
  getSessionArtifacts: vi.fn(async () => mocks.sessionGroup),
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
    data: mocks.relaunchArtifact,
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

    mocks.relaunchArtifact = {
      artifactId: 'a-angle-step',
      requestId: 'r-angle-step',
      projectId: 'p-1',
      sessionId: 'sess_demo',
      stepKey: 'context-and-angle-matrix',
      artifactRole: 'step',
      runMode: 'regenerate',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      toolKey: 'angle-generator',
      workflowType: 'angle_generator',
      content: 'artifact content',
      createdAt: '2026-05-09T09:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
      sourceRequest: {
        requestId: 'req-source-angle',
        userId: 'user-1',
        projectId: 'p-1',
        artifactType: 'content',
        model: 'openrouter/auto',
        input: {
          notes: 'angle notes',
          tone: 'Formal',
          briefingId: 'brief-angle',
          briefingFileName: 'brief-angle.txt',
        },
        workflowType: 'angle_generator',
        outputFormat: 'markdown',
        toolKey: 'angle-generator',
      },
    };

    renderPage(SessionSummaryDetailPage);

    expect(await screen.findByTestId('session-artifact-tabs')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Project One - Angle Generator' })).toBeInTheDocument();
    expect(screen.getAllByText('Angle Generator').length).toBeGreaterThan(0);
    expect(screen.queryByText('Tool non disponibile')).not.toBeInTheDocument();
  });

  it('keeps relaunch enabled for angle-generator when latest artifact is non-step but a step artifact exists', async () => {
    const { SessionSummaryDetailPage } = await import('./SessionSummaryDetailPage');

    mocks.sessionGroup = {
      sessionId: 'sess_demo',
      toolKey: 'angle-generator',
      status: 'completed',
      artifacts: [
        {
          artifactId: 'a-angle-nostep',
          requestId: 'r-angle-nostep',
          projectId: 'p-1',
          stepKey: null,
          artifactRole: 'step',
          status: 'completed',
          content: 'non-step artifact',
          updatedAt: '2026-05-09T10:10:00.000Z',
          failureReason: null,
          workflowType: 'angle_generator',
          toolKey: 'angle-generator',
          runMode: 'regenerate',
        },
        {
          artifactId: 'a-angle-step',
          requestId: 'r-angle-step',
          projectId: 'p-1',
          stepKey: 'angle-prioritization',
          artifactRole: 'step',
          status: 'completed',
          content: 'step artifact',
          updatedAt: '2026-05-09T10:00:00.000Z',
          failureReason: null,
          workflowType: 'angle_generator',
          toolKey: 'angle-generator',
          runMode: 'regenerate',
        },
      ],
    };

    mocks.relaunchArtifact = {
      artifactId: 'a-angle-step',
      requestId: 'r-angle-step',
      projectId: 'p-1',
      sessionId: 'sess_demo',
      stepKey: 'angle-prioritization',
      artifactRole: 'step',
      runMode: 'regenerate',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      toolKey: 'angle-generator',
      workflowType: 'angle_generator',
      content: 'step artifact',
      createdAt: '2026-05-09T09:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
      sourceRequest: {
        requestId: 'req-source-angle-step',
        userId: 'user-1',
        projectId: 'p-1',
        artifactType: 'content',
        model: 'openrouter/auto',
        input: {
          notes: 'angle notes',
          tone: 'Formal',
          briefingId: 'brief-angle',
          briefingFileName: 'brief-angle.txt',
        },
        workflowType: 'angle_generator',
        outputFormat: 'markdown',
        toolKey: 'angle-generator',
      },
    };

    renderPage(SessionSummaryDetailPage);

    const relaunchLink = await screen.findByRole('link', { name: 'Rilancia' });
    expect(relaunchLink).not.toHaveAttribute('aria-disabled', 'true');
    expect(relaunchLink.getAttribute('href')).toContain('/tools/angle-generator?');
    expect(relaunchLink.getAttribute('href')).toContain('sourceArtifactId=a-angle-step');
  });

  it('keeps Rilancia as the relaunch UI contract and does not expose a manual extraction CTA', async () => {
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

    mocks.relaunchArtifact = {
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
          tone: 'Formal',
          briefingId: 'brief-1',
          briefingFileName: 'brief.txt',
        },
        workflowType: 'funnel_pages',
        outputFormat: 'markdown',
        toolKey: 'funnel-pages',
      },
    };

    renderPage(SessionSummaryDetailPage);

    const relaunchLink = await screen.findByRole('link', { name: 'Rilancia' });
    expect(relaunchLink).toHaveAttribute('href', expect.stringContaining('/tools/funnel-pages?'));
    expect(relaunchLink).toHaveAttribute('href', expect.stringContaining('intent=regenerate'));
    expect(relaunchLink).toHaveAttribute('href', expect.stringContaining('projectId=p-1'));
    expect(relaunchLink).toHaveAttribute('href', expect.stringContaining('sourceArtifactId=a-1'));
    expect(relaunchLink).toHaveAttribute('href', expect.stringContaining('relaunchFromArtifactId=a-1'));
    expect(screen.queryByRole('button', { name: /avvia estrazione/i })).not.toBeInTheDocument();
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

    mocks.relaunchArtifact = {
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
          tone: 'Formal',
          briefingId: 'brief-1',
          briefingFileName: 'brief.txt',
        },
        workflowType: 'funnel_pages',
        outputFormat: 'markdown',
        toolKey: 'funnel-pages',
      },
    };

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
