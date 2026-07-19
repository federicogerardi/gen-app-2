import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Link, Route, Routes } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { renderProjectPage } from '../test/renderProjectPage';
import { ProjectsListPage } from './ProjectsListPage';

vi.mock('../../../app/providers/AuthSessionProvider', async () => {
  const { createMockAuthSessionProvider } = await import('../../../test/mocks/auth-session-provider.mock');
  return createMockAuthSessionProvider({ role: 'member', userId: 'u1', email: 'u@test.com', capabilities: { projects: true, models: false, artifacts: false, toolsUpload: false } });
});

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
    renderProjectPage(<ProjectsListPage />);

    expect(await screen.findByText('Project Alpha')).toBeInTheDocument();
    expect(screen.queryByText(appCopy.ui.fallbackErrors.loadProjects)).toBeNull();
  });

  it('shows load error when the request fails', async () => {
    useMswHandler(
      http.get('/api/projects', () => new HttpResponse(null, { status: 500 })),
    );

    renderProjectPage(<ProjectsListPage />);

    expect(await screen.findByText(/Unable to list projects/i)).toBeInTheDocument();
  });

  it('refetches remote projects after SPA navigation remount', async () => {
    let requestCount = 0;
    useMswHandler(
      http.get('/api/projects', () => {
        requestCount += 1;

        return HttpResponse.json([
          {
            id: `p${requestCount}`,
            name: `Project ${requestCount}`,
            description: `Descrizione ${requestCount}`,
            updatedAt: '2026-04-27T10:00:00.000Z',
          },
        ]);
      }),
    );

    renderProjectPage(
      <Routes>
        <Route
          path="/start"
          element={<Link to="/dashboard/projects">Open projects</Link>}
        />
        <Route
          path="/dashboard/projects"
          element={<ProjectsListPage />}
        />
      </Routes>,
      { initialEntries: ['/start'] },
    );

    fireEvent.click(screen.getByRole('link', { name: 'Open projects' }));
    expect(await screen.findByText('Project 1')).toBeInTheDocument();
    await waitFor(() => {
      expect(requestCount).toBe(1);
    });
  });
});