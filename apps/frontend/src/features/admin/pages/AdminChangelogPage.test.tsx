import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { useMswHandler } from '../../../test/mocks/server';
import { AdminChangelogPage } from './AdminChangelogPage';

const feedbackApiSpy = vi.hoisted(() => ({
  publishSuccess: vi.fn(),
  publishError: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
}));

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'admin_001', email: 'admin@test.com', role: 'admin' } },
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: {
      changelogList: true,
      userReportsCreate: true,
      adminChangelogCreate: true,
      adminUserReportsList: true,
      adminUserReportsUpdate: true,
      adminUserReportsPublishIssue: true,
    },
  }),
}));

vi.mock('../../../app/providers/FeedbackMessageProvider', () => ({
  useFeedbackMessage: () => ({
    messages: [],
    ...feedbackApiSpy,
  }),
}));

beforeEach(() => {
  feedbackApiSpy.publishSuccess.mockReset();
  feedbackApiSpy.publishError.mockReset();

  useMswHandler(
    http.get('/api/changelog', () => HttpResponse.json({
      ok: true,
      data: {
        changelog: [
          {
            id: 'chg_001',
            title: 'Release 1.0',
            body: 'Initial release',
            status: 'published',
            createdBy: 'admin_001',
            publishedBy: 'admin_001',
            publishedAt: '2026-05-16T12:00:00.000Z',
            createdAt: '2026-05-16T12:00:00.000Z',
            updatedAt: '2026-05-16T12:00:00.000Z',
          },
        ],
      },
    })),
  );

  useMswHandler(
    http.post('/api/admin/changelog', () => HttpResponse.json({
      ok: true,
      data: {
        changelog: {
          id: 'chg_002',
          title: 'Release 1.1',
          body: 'Patch release',
          status: 'published',
          createdBy: 'admin_001',
          publishedBy: 'admin_001',
          publishedAt: '2026-05-16T12:30:00.000Z',
          createdAt: '2026-05-16T12:30:00.000Z',
          updatedAt: '2026-05-16T12:30:00.000Z',
        },
      },
    }, { status: 201 })),
  );
});

describe('AdminChangelogPage', () => {
  it('renders published changelog table', async () => {
    render(
      <MemoryRouter>
        <AdminChangelogPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Release 1.0')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Admin changelog' })).toBeInTheDocument();
  });

  it('publishes changelog and emits global success feedback', async () => {
    render(
      <MemoryRouter>
        <AdminChangelogPage />
      </MemoryRouter>,
    );

    await screen.findByText('Release 1.0');

    fireEvent.change(screen.getByRole('textbox', { name: /titolo/i }), { target: { value: 'Release 1.1' } });
    fireEvent.change(screen.getByRole('textbox', { name: /contenuto/i }), { target: { value: 'Patch release' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pubblica changelog' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        'Voce changelog pubblicata.',
        expect.objectContaining({ dedupeKey: 'admin-changelog:publish:success' }),
      );
    });
  });
});
