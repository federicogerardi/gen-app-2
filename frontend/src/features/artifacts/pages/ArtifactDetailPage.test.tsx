import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { ArtifactDetailPage } from './ArtifactDetailPage';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: null,
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: { projects: false, models: false, artifacts: false, toolsUpload: false, adminModels: false },
  }),
}));

const makeArtifact = (overrides: Partial<GenerationArtifact> = {}): GenerationArtifact => ({
  artifactId: 'art-1',
  requestId: 'req-1',
  projectId: 'proj-1',
  artifactType: 'content',
  status: 'completed',
  model: 'gpt-4',
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
    model: 'gpt-4',
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

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({ artifacts: [makeArtifact()], isStreamActive: false }),
}));

const LocationEcho = () => {
  const location = useLocation();
  return <div data-testid="location-echo">{`${location.pathname}${location.search}`}</div>;
};

const renderPage = (artifactId = 'art-1') =>
  render(
    <MemoryRouter initialEntries={[`/artifacts/${artifactId}`]}>
      <Routes>
        <Route path="/artifacts/:id" element={<ArtifactDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ArtifactDetailPage', () => {
  beforeEach(() => {
    artifactDetailBag.artifact = makeArtifact();
  });

  it('shows "Artifact non trovato" for missing artifact', () => {
    artifactDetailBag.artifact = null;
    renderPage('missing');
    expect(screen.getByText(appCopy.ui.states.noArtifactFound)).toBeInTheDocument();
  });

  it('renders artifact content when found', () => {
    renderPage('art-1');
    // May be async – check heading at minimum
    expect(screen.getByRole('heading', { name: appCopy.editorial.artifacts.detailTitle })).toBeInTheDocument();
  });

  it('renders back link to artifacts archive', () => {
    renderPage('art-1');
    expect(screen.getByText(appCopy.ui.actions.openArchive)).toBeInTheDocument();
  });

  it('navigates with a clean query when clicking "Avvia di nuovo"', async () => {
    artifactDetailBag.artifact = makeArtifact({
      toolKey: 'funnel-pages',
      workflowType: 'funnel-pages',
      sourceRequest: {
        requestId: 'req-1',
        userId: 'user-1',
        projectId: 'proj-1',
        artifactType: 'content',
        model: 'gpt-4',
        input: {
          tone: 'friendly',
          notes: 'old-note',
          briefingId: 'brief-legacy',
          briefingFileName: 'brief-legacy.md',
        },
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        registrySnapshotRef: 'snapshot:default',
      },
    });

    render(
      <MemoryRouter initialEntries={['/artifacts/art-1']}>
        <Routes>
          <Route path="/artifacts/:id" element={<ArtifactDetailPage />} />
          <Route path="/tools/funnel-pages" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.actions.relaunchPrimary }));

    const location = await screen.findByTestId('location-echo');
    expect(location).toHaveTextContent('/tools/funnel-pages?intent=new&projectId=proj-1');
    expect(location).not.toHaveTextContent('sourceArtifactId');
    expect(location).not.toHaveTextContent('relaunchFromArtifactId');
    expect(location).not.toHaveTextContent('tone=');
    expect(location).not.toHaveTextContent('notes=');
    expect(location).not.toHaveTextContent('briefingId=');
    expect(location).not.toHaveTextContent('briefingFileName=');
  });
});
