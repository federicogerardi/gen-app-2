import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useMswHandler } from '../../../test/mocks/server';
import { FeedbackNewsSticky } from './FeedbackNewsSticky';

const feedbackApiSpy = vi.hoisted(() => ({
  publishSuccess: vi.fn(),
  publishError: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
}));

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'member_001', email: 'member@test.com', role: 'member' } },
    loading: false,
    hasError: false,
    apiBaseUrl: '',
    capabilities: {
      changelogList: true,
      userReportsCreate: true,
      adminChangelogCreate: true,
      adminUserReportsList: true,
      adminUserReportsUpdate: true,
      adminUserReportsPublishIssue: true,
    },
    oauthStartUrl: '',
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    clearError: () => {},
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

  useMswHandler(http.get('/api/changelog', () => HttpResponse.json({
    ok: true,
    data: {
      changelog: [
        {
          id: 'chg_001',
          title: 'Nuovo runtime changelog',
          body: 'E stato pubblicato un nuovo aggiornamento.',
          status: 'published',
          createdBy: 'admin_001',
          publishedBy: 'admin_001',
          publishedAt: '2026-05-16T10:00:00.000Z',
          createdAt: '2026-05-16T09:00:00.000Z',
          updatedAt: '2026-05-16T10:00:00.000Z',
        },
      ],
    },
  })));

  useMswHandler(http.post('/api/user-reports', async ({ request }) => {
    const body = await request.json() as {
      category: 'issue' | 'feature-request' | 'other';
      title: string;
      description: string;
    };

    return HttpResponse.json({
      ok: true,
      data: {
        report: {
          id: 'rpt_002',
          category: body.category,
          status: 'submitted',
          title: body.title,
          description: body.description,
          createdBy: 'member_001',
          triagedBy: null,
          triagedAt: null,
          closedAt: null,
          createdAt: '2026-05-16T10:00:00.000Z',
          updatedAt: '2026-05-16T10:00:00.000Z',
        },
      },
    }, { status: 201 });
  }));
});

describe('FeedbackNewsSticky', () => {
  it('loads published changelog and submits a report from sticky panel', async () => {
    render(<FeedbackNewsSticky />);

    fireEvent.click(screen.getByRole('button', { name: 'Apri news' }));
    expect(await screen.findByText('Nuovo runtime changelog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Invia segnalazione' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Titolo' }), {
      target: { value: 'Errore nel salvataggio' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Descrizione' }), {
      target: { value: 'Il salvataggio non completa la richiesta.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Invia' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        'Segnalazione inviata con successo.',
        expect.objectContaining({ dedupeKey: 'news-sticky:user-report:success' }),
      );
    });

    expect(screen.queryByRole('button', { name: 'Invia' })).toBeNull();
  });
});
