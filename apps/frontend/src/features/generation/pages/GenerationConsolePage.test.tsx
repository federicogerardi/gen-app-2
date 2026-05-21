import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { GenerationConsolePage } from './GenerationConsolePage';
import type { GenerationArtifact } from '../ui/artifact-history';

const relaunchSourceArtifact: GenerationArtifact = {
  artifactId: 'art-console-1',
  requestId: 'req-console-1',
  projectId: 'proj-console-1',
  artifactType: 'content',
  status: 'completed',
  model: 'openrouter/gpt-4',
  toolKey: 'funnel-pages',
  workflowType: 'funnel_pages',
  content: 'artifact content',
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
  sourceRequest: {
    requestId: 'req-console-1',
    userId: 'user-1',
    projectId: 'proj-console-1',
    artifactType: 'content',
    model: 'openrouter/gpt-4',
    input: {
      tone: 'Formal',
      notes: 'legacy-note',
      briefingId: 'brief-legacy',
      briefingFileName: 'brief-legacy.md',
    },
    toolKey: 'funnel-pages',
    workflowType: 'funnel_pages',
    registrySnapshotRef: 'snapshot:default',
  },
};

const authBag = {
  session: { user: { id: 'user-1', email: 'user@test.com', role: 'member' } },
  capabilities: { projects: false, models: false, artifacts: true, toolsUpload: false, adminModels: false },
};

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: authBag.session,
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: authBag.capabilities,
  }),
}));

vi.mock('../runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({
    artifacts: [relaunchSourceArtifact],
    checkpoints: [],
    focusedProjectId: 'proj-console-1',
    isStreamActive: false,
    streamStatus: 'idle',
    snapshot: {
      context: {
        content: '',
        requestId: null,
        artifactId: null,
        reconnectAttempts: 0,
        errorCode: null,
        errorMessage: null,
      },
      matches: () => false,
    },
    start: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
    setFocusedProjectId: vi.fn(),
    upsertExtractionContext: vi.fn(),
    getExtractionContext: vi.fn(() => null),
  }),
}));

vi.mock('../ui/GenerationForm', () => ({
  GenerationForm: () => <div data-testid="generation-form-stub" />,
}));

vi.mock('../ui/GenerationStreamPanel', () => ({
  GenerationStreamPanel: () => <div data-testid="generation-stream-panel-stub" />,
}));

vi.mock('../ui/ArtifactHistoryPanel', () => ({
  ArtifactHistoryPanel: ({
    artifacts,
    onRelaunchFromArtifact,
  }: {
    artifacts: GenerationArtifact[];
    onRelaunchFromArtifact: (artifact: GenerationArtifact) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onRelaunchFromArtifact(artifacts[0]!)}
      >
        {appCopy.ui.actions.relaunchPrimary}
      </button>
    </div>
  ),
}));

const LocationEcho = () => {
  const location = useLocation();
  return <div data-testid="location-echo">{`${location.pathname}${location.search}`}</div>;
};

describe('GenerationConsolePage', () => {
  it('navigates with deterministic relaunch query when clicking "Avvia di nuovo" from artifact history', async () => {
    render(
      <MemoryRouter initialEntries={['/tools/console']}>
        <Routes>
          <Route path="/tools/console" element={<GenerationConsolePage />} />
          <Route path="/tools/funnel-pages" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.actions.relaunchPrimary }));

    const location = await screen.findByTestId('location-echo');
    expect(location).toHaveTextContent('/tools/funnel-pages?');
    expect(location).toHaveTextContent('intent=regenerate');
    expect(location).toHaveTextContent('projectId=proj-console-1');
    expect(location).toHaveTextContent('sourceArtifactId=art-console-1');
    expect(location).toHaveTextContent('briefingId=brief-legacy');
    expect(location).toHaveTextContent('relaunchFromArtifactId=art-console-1');
    expect(location).toHaveTextContent('tone=Formal');
    expect(location).toHaveTextContent('notes=legacy-note');
    expect(location).toHaveTextContent('briefingFileName=brief-legacy.md');
  });
});
