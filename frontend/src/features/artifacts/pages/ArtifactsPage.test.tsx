import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
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
    session: { user: { id: 'u1', email: 'u@test.com', role: 'member' } },
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
  workspaceBag.artifacts = [
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
  ];
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

  it('refetches remote artifacts after SPA navigation remount', async () => {
    authBag.capabilities = { projects: false, models: false, artifacts: true, toolsUpload: false, adminModels: false };
    let requestCount = 0;

    useMswHandler(
      http.get('/api/artifacts', () => {
        requestCount += 1;

        return HttpResponse.json({
          ok: true,
          data: {
            artifacts: [
              {
                artifactId: `a${requestCount}`,
                requestId: `r${requestCount}`,
                projectId: 'p1',
                artifactType: 'content',
                status: 'completed',
                model: 'gpt-4',
                toolKey: null,
                workflowType: null,
                content: `artifact ${requestCount}`,
                createdAt: '2026-04-27T10:00:00.000Z',
                updatedAt: '2026-04-27T10:00:00.000Z',
                sourceRequest: {
                  requestId: `r${requestCount}`,
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
          },
        });
      }),
    );

    render(
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route
            path="/start"
            element={<Link to="/artifacts">Apri artifacts</Link>}
          />
          <Route
            path="/artifacts"
            element={<ArtifactsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Apri artifacts' }));
    expect(await screen.findByText('content')).toBeInTheDocument();
    await waitFor(() => {
      expect(requestCount).toBe(1);
    });
  });

  it('fetches 10 artifacts per page and requests the next offset', async () => {
    authBag.capabilities = { projects: false, models: false, artifacts: true, toolsUpload: false, adminModels: false };
    const seenQueries: string[] = [];

    useMswHandler(
      http.get('/api/artifacts', ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get('limit') ?? '0');
        const offset = Number(url.searchParams.get('offset') ?? '0');
        seenQueries.push(`limit=${limit};offset=${offset}`);

        const artifacts = Array.from({ length: limit }, (_, index) => {
          const itemNumber = offset + index + 1;

          return {
            artifactId: `a${itemNumber}`,
            requestId: `r${itemNumber}`,
            projectId: 'p1',
            artifactType: 'content',
            status: 'completed',
            model: 'gpt-4',
            toolKey: null,
            workflowType: null,
            content: `artifact ${itemNumber}`,
            createdAt: '2026-04-27T10:00:00.000Z',
            updatedAt: `2026-04-27T10:00:${String(itemNumber).padStart(2, '0')}.000Z`,
            sourceRequest: {
              requestId: `r${itemNumber}`,
              userId: 'u1',
              projectId: 'p1',
              artifactType: 'content',
              model: 'gpt-4',
              input: {},
              toolKey: null,
              workflowType: null,
            },
          };
        });

        return HttpResponse.json({ ok: true, data: { artifacts } });
      }),
    );

    render(
      <MemoryRouter>
        <ArtifactsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Page 1')).toBeInTheDocument();
    await waitFor(() => {
      expect(seenQueries).toEqual(['limit=10;offset=0']);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(seenQueries).toEqual(['limit=10;offset=0', 'limit=10;offset=10']);
    });
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('paginates local fallback artifacts in batches of 10', async () => {
    workspaceBag.artifacts = Array.from({ length: 12 }, (_, index) => {
      const itemNumber = index + 1;

      return {
        artifactId: `a${itemNumber}`,
        requestId: `r${itemNumber}`,
        projectId: 'p1',
        artifactType: 'content' as const,
        status: 'completed' as const,
        model: 'gpt-4',
        toolKey: null,
        workflowType: null,
        content: `artifact content ${itemNumber}`,
        createdAt: '2026-04-27T10:00:00.000Z',
        updatedAt: `2026-04-27T10:00:${String(itemNumber).padStart(2, '0')}.000Z`,
        sourceRequest: {
          requestId: `r${itemNumber}`,
          userId: 'u1',
          projectId: 'p1',
          artifactType: 'content' as const,
          model: 'gpt-4',
          input: {},
          toolKey: null,
          workflowType: null,
        },
      };
    });

    render(
      <MemoryRouter>
        <ArtifactsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Page 1')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Apri dettaglio' })).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('Page 2')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('link', { name: 'Apri dettaglio' })).toHaveLength(2);
  });
});