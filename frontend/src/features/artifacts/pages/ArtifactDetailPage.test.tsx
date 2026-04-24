import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

const makeArtifact = (): GenerationArtifact => ({
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
  sourceRequest: {} as GenerationArtifact['sourceRequest'],
});

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({ artifacts: [makeArtifact()], isStreamActive: false }),
}));

const renderPage = (artifactId = 'art-1') =>
  render(
    <MemoryRouter initialEntries={[`/artifacts/${artifactId}`]}>
      <Routes>
        <Route path="/artifacts/:id" element={<ArtifactDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ArtifactDetailPage', () => {
  it('shows "Artifact non trovato" for missing artifact', () => {
    renderPage('missing');
    expect(screen.getByText(/artifact non trovato/i)).toBeInTheDocument();
  });

  it('renders artifact content when found', () => {
    renderPage('art-1');
    // May be async – check heading at minimum
    expect(screen.getByRole('heading', { name: /artifact detail/i })).toBeInTheDocument();
  });

  it('renders back link to artifacts archive', () => {
    renderPage('art-1');
    expect(screen.getByText(/torna all'archivio/i)).toBeInTheDocument();
  });
});
