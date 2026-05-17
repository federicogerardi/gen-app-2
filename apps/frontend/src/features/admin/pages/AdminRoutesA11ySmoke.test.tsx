import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';

import { useMswHandlers } from '../../../test/mocks/server';
import { buildUsersHandlers, buildModelsHandlers, buildChangelogHandlers, buildUserReportsHandlers } from '../test/msw-admin-factories';
import { getMockAuthSession, resetMockAdminSession } from '../test/mockAdminSession';
import { AdminActivityPage } from './AdminActivityPage';
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
    },
  });

  useMswHandlers(
    ...buildUsersHandlers(),
    ...buildModelsHandlers(),
    ...buildChangelogHandlers(),
    ...buildUserReportsHandlers(),
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

  it.each([
    ['/admin', <AdminDashboardPage />, 'Dashboard admin', 1],
    ['/admin/users', <AdminUsersPage />, 'Admin users', 4],
    ['/admin/models', <AdminModelsPage />, 'Admin models', 4],
    ['/admin/changelog', <AdminChangelogPage />, 'Admin changelog', 4],
    ['/admin/user-reports', <AdminUserReportsPage />, 'Admin user reports', 4],
    ['/admin/activity', <AdminActivityPage />, 'Attività recente', 0],
  ])('has at least %d keyboard-accessible controls on %s', async (path, element, expectedHeading, minTabStops) => {
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

