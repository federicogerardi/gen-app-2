import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { ArtifactsPage } from './ArtifactsPage';

const authBag = {
  capabilities: { projects: true, models: false, artifacts: false, toolsUpload: false, adminModels: false },
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
    hasError: false,
    apiBaseUrl: '',
    capabilities: authBag.capabilities,
    oauthStartUrl: '',
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    clearError: () => {},
  }),
  useAuthState: () => ({
    session: { user: { id: 'u1', email: 'u@test.com', role: 'member' } },
    loading: false,
    hasError: false,
  }),
  useAuthActions: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    clearError: () => {},
  }),
  useApiConfig: () => ({
    apiBaseUrl: '',
    capabilities: authBag.capabilities,
  }),
  useOAuthUrl: () => ({
    oauthStartUrl: '',
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => workspaceBag,
}));

beforeEach(() => {
  authBag.capabilities = { projects: true, models: false, artifacts: false, toolsUpload: false, adminModels: false };
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
  useMswHandler(http.get('/api/projects', () => HttpResponse.json({
    ok: true,
    data: {
      projects: [
        {
          id: 'p1',
          name: 'Project One',
          description: 'Descrizione progetto',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
    },
  })));
  useMswHandler(http.get('/api/artifacts', () => HttpResponse.json({ ok: true, data: { artifacts: [], totalResults: 0 } })));
});

describe('ArtifactsPage', () => {
  it('renders artifacts from local fallback when capability is disabled', async () => {
    render(
      <MemoryRouter>
        <ArtifactsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('content')).toBeInTheDocument();
    expect(screen.getByText('u1')).toBeInTheDocument();
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
            totalResults: 1,
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
    workspaceBag.artifacts = [];
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

        return HttpResponse.json({ ok: true, data: { artifacts, totalResults: 21 } });
      }),
    );

    render(
      <MemoryRouter>
        <ArtifactsPage />
      </MemoryRouter>,
    );

    const page1Button = await screen.findByRole('button', { name: `${appCopy.ui.labels.page} 1` });
    expect(page1Button).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.actions.nextPage }));

    await waitFor(() => {
      expect(seenQueries).toContain('limit=11;offset=10');
    });
    const page2Button = screen.getByRole('button', { name: `${appCopy.ui.labels.page} 2` });
    expect(page2Button).toHaveAttribute('aria-current', 'page');
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

    const page1Button = await screen.findByRole('button', { name: `${appCopy.ui.labels.page} 1` });
    expect(page1Button).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: `${appCopy.ui.labels.page} 2` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `${appCopy.ui.labels.page} 3` })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Apri dettaglio' })).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.actions.nextPage }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: `${appCopy.ui.labels.page} 2` })).toHaveAttribute('aria-current', 'page');
    });
    expect(screen.queryByRole('button', { name: `${appCopy.ui.labels.page} 3` })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Apri dettaglio' })).toHaveLength(2);
  });
});