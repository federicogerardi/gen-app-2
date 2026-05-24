import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { http, HttpResponse } from 'msw';

import { useMswHandler, useMswHandlers } from '../../../test/mocks/server';
import { buildUsersHandlers, buildModelsHandlers, buildChangelogHandlers, buildUserReportsHandlers } from '../test/msw-admin-factories';
import { getMockAuthSession, resetMockAdminSession } from '../test/mockAdminSession';
import { AdminActivityPage } from './AdminActivityPage';
import { AdminApiServicesPage } from './AdminApiServicesPage';
import { AdminChangelogPage } from './AdminChangelogPage';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminModelsPage } from './AdminModelsPage';
import { AdminUserReportsPage } from './AdminUserReportsPage';
import { AdminUsersPage } from './AdminUsersPage';

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => getMockAuthSession(),
}));

vi.mock('../../../app/providers/FeedbackMessageProvider', () => ({
  useFeedbackMessage: () => ({
    messages: [],
    publishSuccess: vi.fn(),
    publishError: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({
    checkpoints: [
      {
        artifactId: 'art_001',
        projectId: 'proj_001',
        status: 'completed',
        extractionContextAvailable: true,
        model: 'openrouter/auto',
        workflowType: 'funnel_pages',
        toolKey: 'funnel-pages',
        contentPreview: 'preview',
        updatedAt: '2026-05-17T09:00:00.000Z',
      },
    ],
  }),
}));

const renderRoute = (path: string, element: ReactElement) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  );
};

const expectInteractiveControlsToBeNamed = () => {
  screen.queryAllByRole('button').forEach((button) => {
    expect(button).toHaveAccessibleName();
  });

  screen.queryAllByRole('link').forEach((link) => {
    expect(link).toHaveAccessibleName();
  });

  screen.queryAllByRole('textbox').forEach((textbox) => {
    expect(textbox).toHaveAccessibleName();
  });

  screen.queryAllByRole('combobox').forEach((combobox) => {
    expect(combobox).toHaveAccessibleName();
  });
};

beforeEach(() => {
  resetMockAdminSession({
    role: 'admin',
    userId: 'admin_001',
    email: 'admin@test.com',
    capabilities: {
      projects: true,
      changelogList: true,
      adminChangelogCreate: true,
      adminChangelogArchive: true,
      adminUserReportsList: true,
      adminUserReportsUpdate: true,
      adminUserReportsPublishIssue: true,
      userReportsCreate: true,
      adminModels: true,
      adminApiServicesCrud: true,
    },
  });

  useMswHandlers(
    ...buildUsersHandlers(),
    ...buildModelsHandlers(),
    ...buildChangelogHandlers(),
    ...buildUserReportsHandlers(),
  );

  useMswHandler(
    http.get('/api/admin/api-services', () => HttpResponse.json({
      ok: true,
      data: {
        apiServices: [
          {
            id: 'svc_001',
            key: 'core-api',
            label: 'Core API',
            baseUrl: 'https://api.example.com',
            resourcePath: '/v1/core',
            accessMode: 'public',
            timeoutMs: 3000,
            retryCount: 2,
            requestMethod: 'GET',
            requestTemplateJson: {},
            requestMappingRulesJson: [],
            requestHeadersTemplateJson: {},
            responseMappingRulesJson: [],
            errorMappingRulesJson: [],
            contractProfileVersion: 1,
            status: 'active',
            tokenConfigured: false,
            createdAt: '2026-05-16T10:00:00.000Z',
            updatedAt: '2026-05-16T10:00:00.000Z',
          },
        ],
      },
    })),
  );
});

describe('Admin routes a11y smoke', () => {
  it.each([
    ['/admin', <AdminDashboardPage />, 'Dashboard admin'],
    ['/admin/users', <AdminUsersPage />, 'Admin users'],
    ['/admin/models', <AdminModelsPage />, 'Admin models'],
    ['/admin/changelog', <AdminChangelogPage />, 'Admin changelog'],
    ['/admin/user-reports', <AdminUserReportsPage />, 'Admin user reports'],
    ['/admin/activity', <AdminActivityPage />, 'Attività recente'],
  ])('exposes named controls and heading on %s', async (path, element, expectedHeading) => {
    renderRoute(path, element);

    expect(await screen.findByRole('heading', { name: expectedHeading })).toBeInTheDocument();
    expectInteractiveControlsToBeNamed();
  });

  it('exposes named controls and heading on /admin/api-services', async () => {
    renderRoute('/admin/api-services', <AdminApiServicesPage />);

    expect(await screen.findByRole('heading', { name: 'Admin ApiService' })).toBeInTheDocument();
    expectInteractiveControlsToBeNamed();
  });

  it.each([
    ['/admin', <AdminDashboardPage />, 'Dashboard admin', 1],
    ['/admin/users', <AdminUsersPage />, 'Admin users', 4],
    ['/admin/models', <AdminModelsPage />, 'Admin models', 4],
    ['/admin/changelog', <AdminChangelogPage />, 'Admin changelog', 4],
    ['/admin/user-reports', <AdminUserReportsPage />, 'Admin user reports', 4],
    ['/admin/activity', <AdminActivityPage />, 'Attività recente', 0],
  ])('has at least keyboard-accessible controls on %s', async (path, element, expectedHeading, minTabStops) => {
    renderRoute(path, element);

    expect(await screen.findByRole('heading', { name: expectedHeading })).toBeInTheDocument();

    const interactiveCount = [
      ...screen.queryAllByRole('button').filter((el) => !el.hasAttribute('disabled')),
      ...screen.queryAllByRole('link'),
      ...screen.queryAllByRole('textbox').filter((el) => !el.hasAttribute('disabled')),
      ...screen.queryAllByRole('combobox').filter((el) => !el.hasAttribute('disabled')),
    ].length;

    expect(interactiveCount).toBeGreaterThanOrEqual(minTabStops);
  });
});

