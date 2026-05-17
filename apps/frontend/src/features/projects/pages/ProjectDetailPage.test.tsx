import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { renderProjectPage } from '../test/renderProjectPage';
import { ProjectDetailPage } from './ProjectDetailPage';

const workspaceBag = {
  artifacts: [
    {
      artifactId: 'art-1',
      requestId: 'req-1',
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
        requestId: 'req-1',
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
    capabilities: { projects: true, models: false, artifacts: false, sessionsList: true, sessionsDetail: true, toolsUpload: false },
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => workspaceBag,
}));

const renderPage = (projectId = 'p1') => renderProjectPage(
  <Routes>
    <Route path="/dashboard/projects/:id" element={<ProjectDetailPage />} />
  </Routes>,
  { initialEntries: [`/dashboard/projects/${projectId}`] },
);

beforeEach(() => {
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
  useMswHandler(http.get('/api/projects/:id', ({ params }) => {
    if (params.id !== 'p1') {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({
      ok: true,
      data: {
        project: {
          id: 'p1',
          name: 'Project One',
          description: 'Descrizione progetto',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      },
    });
  }));
  useMswHandler(http.get('/api/tools/sessions', () => HttpResponse.json({
    ok: true,
    data: {
      sessions: [
        {
          sessionId: 'sess_demo',
          projectId: 'p1',
          toolKey: 'funnel-pages',
          status: 'completed',
          artifactCount: 1,
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
    },
  })));
});

describe('ProjectDetailPage', () => {
  it('renders project detail and contextual sessions', async () => {
    renderPage();

    expect(await screen.findByText('Project One')).toBeInTheDocument();
    expect(screen.getByText(appCopy.editorial.projects.contextualSessions)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: appCopy.ui.actions.openDetail })).toBeInTheDocument();
  });

  it('shows not found state when project detail returns 404', async () => {
    useMswHandler(
      http.get('/api/projects/missing', () => new HttpResponse(null, { status: 404 })),
    );

    renderPage('missing');

    expect(await screen.findByText(appCopy.ui.states.noProjectFound)).toBeInTheDocument();
  });
});
