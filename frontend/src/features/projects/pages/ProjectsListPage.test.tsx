import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { ProjectsListPage } from './ProjectsListPage';

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'u1', email: 'u@test.com', role: 'user' } },
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: { projects: true, models: false, artifacts: false, toolsUpload: false, adminModels: false },
  }),
}));

beforeEach(() => {
  useMswHandler(
    http.get('/api/projects', () => HttpResponse.json([
      {
        id: 'p1',
        name: 'Project Alpha',
        description: 'Descrizione alpha',
        updatedAt: '2026-04-27T10:00:00.000Z',
      },
    ])),
  );
});

describe('ProjectsListPage', () => {
  it('renders loaded projects without showing load error fallback', async () => {
    render(
      <MemoryRouter>
        <ProjectsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Project Alpha')).toBeInTheDocument();
    expect(screen.queryByText(appCopy.ui.fallbackErrors.loadProjects)).toBeNull();
  });

  it('shows load error when the request fails', async () => {
    useMswHandler(
      http.get('/api/projects', () => new HttpResponse(null, { status: 500 })),
    );

    render(
      <MemoryRouter>
        <ProjectsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Unable to list projects/i)).toBeInTheDocument();
  });
});