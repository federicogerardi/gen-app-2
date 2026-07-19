import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useMswHandler } from '../../../test/mocks/server';
import { createMockAuthSessionProvider } from '../../../test/mocks/auth-session-provider.mock';
import { FeedbackNewsSticky } from './FeedbackNewsSticky';

import { createFeedbackApiSpy } from '../../../test/mocks/feedback-message-spy.mock';
const feedbackApiSpy = createFeedbackApiSpy();

vi.mock('../../../app/providers/AuthSessionProvider', () => createMockAuthSessionProvider({
  role: 'member',
  userId: 'member_001',
  email: 'member@test.com',
  capabilities: {
    changelogList: true,
    userReportsCreate: true,
    adminChangelogCreate: true,
    adminUserReportsList: true,
    adminUserReportsUpdate: true,
    adminUserReportsPublishIssue: true,
  },
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
          title: 'New runtime changelog',
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

    fireEvent.click(screen.getByRole('button', { name: 'Open news' }));
    expect(await screen.findByText('New runtime changelog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Save error' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'Il salvataggio non completa la richiesta.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        'Report submitted successfully.',
        expect.objectContaining({ dedupeKey: 'news-sticky:user-report:success' }),
      );
    });

    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
  });
});
