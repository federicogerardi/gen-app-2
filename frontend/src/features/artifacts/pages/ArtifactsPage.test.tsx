import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { useMswHandler } from '../../../test/mocks/server';
import { ArtifactsPage } from './ArtifactsPage';

const authBag = {
  capabilities: { projects: false, models: false, artifacts: false, toolsUpload: false, adminModels: false },
};

const workspaceBag = {
  artifacts: [
    {
      artifactId: 'a1',
      requestId: 'r1',
      projectId: 'p1',
      artifactType: 'content',
      status: 'completed',
      model: 'gpt-4',
      toolKey: null,
      workflowType: null,
      content: 'artifact content',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
      sourceRequest: {
        requestId: 'r1',
        userId: 'u1',
        projectId: 'p1',
        artifactType: 'content',
        model: 'gpt-4',
        input: {},
        toolKey: null,
        workflowType: null,
      },
    },
  ],
};

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'u1', email: 'u@test.com', role: 'user' } },
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: authBag.capabilities,
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => workspaceBag,
}));

beforeEach(() => {
  authBag.capabilities = { projects: false, models: false, artifacts: false, toolsUpload: false, adminModels: false };
  useMswHandler(
    http.get('/api/artifacts', () => HttpResponse.json({ ok: true, data: { artifacts: [] } })),
  );
});

describe('ArtifactsPage', () => {
  it('renders artifacts from local fallback when capability is disabled', async () => {
    render(
      <MemoryRouter>
        <ArtifactsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('content')).toBeInTheDocument();
    expect(screen.getByText(/project: p1/i)).toBeInTheDocument();
  });

  it('shows load error when API request fails', async () => {
    authBag.capabilities = { projects: false, models: false, artifacts: true, toolsUpload: false, adminModels: false };
    useMswHandler(
      http.get('/api/artifacts', () => new HttpResponse(null, { status: 500 })),
    );

    render(
      <MemoryRouter>
        <ArtifactsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to list artifacts/i);
  });
});