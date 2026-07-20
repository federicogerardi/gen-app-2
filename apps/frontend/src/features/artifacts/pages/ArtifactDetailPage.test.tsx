import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { ArtifactDetailPage, isSessionSummaryRouteId } from './ArtifactDetailPage';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

vi.mock('../../../app/providers/AuthSessionProvider', async () => {
  const { createMockAuthSessionProvider } = await import('../../../test/mocks/auth-session-provider.mock');
  return createMockAuthSessionProvider({ session: null, capabilities: { projects: false, models: false, artifacts: false, sessionsList: false, sessionsDetail: false, toolsUpload: false } });
});

const makeArtifact = (overrides: Partial<GenerationArtifact> = {}): GenerationArtifact => ({
  artifactId: 'art-1',
  requestId: 'req-1',
  projectId: 'proj-1',
  artifactType: 'content',
  status: 'completed',
  model: 'openrouter/gpt-4',
  toolKey: null,
  workflowType: null,
  content: 'Hello artifact',
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
  sourceRequest: {
    requestId: 'req-1',
    userId: 'user-1',
    projectId: 'proj-1',
    artifactType: 'content',
    model: 'openrouter/gpt-4',
    input: {},
    toolKey: null,
    workflowType: null,
    registrySnapshotRef: 'snapshot:default',
  },
  ...overrides,
});

const artifactDetailBag: { artifact: GenerationArtifact | null } = {
  artifact: makeArtifact(),
};

vi.mock('../../../app/runtime/queries/useArtifactDetailQuery', () => ({
  useArtifactDetailQuery: ({ artifactId }: { artifactId: string }) => ({
    data: artifactDetailBag.artifact?.artifactId === artifactId ? artifactDetailBag.artifact : null,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../../../app/runtime/queries/useProjectsQuery', () => ({
  useProjectsQuery: () => ({
    data: [{ id: 'proj-1', name: 'Project Apollo', description: '', updatedAt: '2026-04-24T00:00:00.000Z' }],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

const renderPage = (artifactId = 'art-1') =>
  render(
      <MemoryRouter initialEntries={[`/artifacts/${artifactId}`]}>
        <Routes>
          <Route path="/artifacts/:artifactId" element={<ArtifactDetailPage />} />
        </Routes>
      </MemoryRouter>,
  );

describe('ArtifactDetailPage', () => {
  beforeEach(() => {
    artifactDetailBag.artifact = makeArtifact();
  });

  it('detects legacy session route ids', () => {
    expect(isSessionSummaryRouteId('sess_demo')).toBe(true);
    expect(isSessionSummaryRouteId('art-1')).toBe(false);
  });

  it('shows "Artifact non trovato" for missing artifact', () => {
    artifactDetailBag.artifact = null;
    renderPage('missing');
    expect(screen.getByText(appCopy.ui.states.noArtifactFound)).toBeInTheDocument();
  });

  it('renders artifact content when found', () => {
    renderPage('art-1');
    expect(screen.getByRole('heading', { name: appCopy.editorial.artifacts.detailTitle })).toBeInTheDocument();
  });

  it('renders back link to artifacts archive', () => {
    renderPage('art-1');
    expect(screen.getByText(appCopy.ui.actions.openArchive)).toBeInTheDocument();
  });

  it('shows step name, generating tool name, and a human-readable completed date', () => {
    artifactDetailBag.artifact = makeArtifact({
      stepKey: 'intro-structure',
      toolKey: 'funnel-pages',
      completedAt: '2026-05-08T11:22:33.000Z',
    });

    renderPage('art-1');

    expect(screen.getByRole('heading', { name: 'Intro Structure' })).toBeInTheDocument();
    expect(screen.getByText(/Hotlead Funnel - Project Apollo/)).toBeInTheDocument();
    expect(screen.queryByText('2026-05-08T11:22:33.000Z')).not.toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('shows tool from workflowType fallback when toolKey is missing', () => {
    artifactDetailBag.artifact = makeArtifact({
      toolKey: null,
      workflowType: 'funnel_pages',
      sourceRequest: {
        requestId: 'req-1',
        userId: 'user-1',
        projectId: 'proj-1',
        artifactType: 'content',
        model: 'openrouter/gpt-4',
        input: {},
        toolKey: null,
        workflowType: 'funnel_pages',
      },
    });

    renderPage('art-1');
    expect(screen.getByText(/Hotlead Funnel - Project Apollo/)).toBeInTheDocument();
  });

  it('links to session detail when artifact has a sessionId', () => {
    artifactDetailBag.artifact = makeArtifact({
      sessionId: 'sess_demo',
    });

    renderPage('art-1');
    expect(screen.getByRole('link', { name: 'Open session' })).toHaveAttribute('href', '/workspaces/proj-1/sessions/sess_demo');
  });

  it('shows a disabled session CTA with explicit copy when sessionId is missing', () => {
    artifactDetailBag.artifact = makeArtifact({
      sessionId: null,
    });

    renderPage('art-1');
    expect(screen.getByRole('button', { name: appCopy.ui.session.unavailable })).toBeDisabled();
  });

  it('does not render a relaunch CTA', () => {
    renderPage('art-1');
    expect(screen.queryByRole('link', { name: appCopy.ui.actions.relaunchPrimary })).not.toBeInTheDocument();
  });

  it('redirects legacy session-style artifact ids to /workspaces', async () => {
    render(
      <MemoryRouter initialEntries={['/artifacts/sess_demo']}>
        <Routes>
          <Route path="/artifacts/:artifactId" element={<ArtifactDetailPage />} />
          <Route path="/workspaces" element={<div data-testid="workspace-echo">workspace</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('workspace-echo')).toBeInTheDocument();
  });
});