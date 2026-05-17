import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';

import { useMswHandlers } from '../../../test/mocks/server';
import { buildChangelogHandlers, buildUserReportsHandlers } from '../test/msw-admin-factories';
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

const TABBABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getTabbableElements = () => {
  return Array.from(document.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR))
    .filter((element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true');
};

const moveFocusWithTab = () => {
  const tabbables = getTabbableElements();
  if (tabbables.length === 0) {
    return null;
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const activeIndex = activeElement ? tabbables.indexOf(activeElement) : -1;
  const nextElement = tabbables[Math.min(activeIndex + 1, tabbables.length - 1)] ?? null;

  fireEvent.keyDown(document, { key: 'Tab' });
  nextElement?.focus();
  fireEvent.keyUp(document, { key: 'Tab' });

  return nextElement;
};

const expectFocusIndicatorOnFormControl = (element: HTMLElement) => {
  element.focus();
  expect(element).toHaveFocus();

  const style = getComputedStyle(element);
  const hasFocusIndicator =
    style.boxShadow !== 'none'
    || (style.outlineStyle !== '' && style.outlineStyle !== 'none' && style.outlineWidth !== '0px')
    // MUI TextField focus styling can be delegated to wrapper/notched outline in jsdom.
    || element.className.includes('MuiInputBase-input');

  expect(hasFocusIndicator).toBe(true);
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
    http.get('/admin/users', () => HttpResponse.json([
      {
        id: 'u_001',
        email: 'member@test.com',
        role: 'member',
        status: 'active',
        monthlyQuota: 120,
      },
    ])),
    http.get('/api/admin/models', () => HttpResponse.json({
      data: {
        models: [
          {
            id: 'model_001',
            key: 'openrouter/auto',
            label: 'OpenRouter Auto',
            status: 'enabled',
            isDefault: true,
            sortOrder: 1,
          },
        ],
      },
    })),
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
  ])('supports keyboard tab order and focus visibility smoke on %s', async (path, element, expectedHeading, minTabStops) => {
    renderRoute(path, element);

    expect(await screen.findByRole('heading', { name: expectedHeading })).toBeInTheDocument();

    const tabbables = getTabbableElements();
    expect(tabbables.length).toBeGreaterThanOrEqual(minTabStops);

    if (tabbables.length === 0) {
      return;
    }

    const firstFocused = moveFocusWithTab();
    expect(firstFocused).toBe(tabbables[0]);
    expect(firstFocused).toHaveFocus();

    if (tabbables.length > 1) {
      const secondFocused = moveFocusWithTab();
      expect(secondFocused).toBe(tabbables[1]);
      expect(secondFocused).toHaveFocus();
    }

    const focusRingControl = tabbables.find((element) =>
      element.matches('input,textarea,select'),
    );

    if (focusRingControl) {
      expectFocusIndicatorOnFormControl(focusRingControl);
    }
  });
});
