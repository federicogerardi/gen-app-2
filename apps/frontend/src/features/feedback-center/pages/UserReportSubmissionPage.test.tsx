import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { useMswHandler } from '../../../test/mocks/server';
import { UserReportSubmissionPage } from './UserReportSubmissionPage';

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
    http.post('/api/user-reports', async ({ request }) => {
      const body = await request.json() as {
        category: 'issue' | 'feature-request' | 'other';
        title: string;
        description: string;
      };

      return HttpResponse.json({
        ok: true,
        data: {
          report: {
            id: 'rpt_new_001',
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
    }),
  );
});

describe('UserReportSubmissionPage', () => {
  it('submits report and requires ACK_SUCCESS to return to idle', async () => {
    render(
      <MemoryRouter>
        <UserReportSubmissionPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /titolo/i }), { target: { value: 'Cannot save project' } });
    fireEvent.change(screen.getByRole('textbox', { name: /descrizione/i }), { target: { value: 'Save fails with 500.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia report' }));

    expect(await screen.findByText('Report submitted successfully.')).toBeInTheDocument();

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        'Report submitted successfully.',
        expect.objectContaining({ dedupeKey: 'feedback-center:user-report:submit:success' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back to form' }));
    expect(screen.queryByText('Report submitted successfully.')).toBeNull();
  });

  it('shows inline-action error on submit failure and supports RESET_TO_IDLE', async () => {
    useMswHandler(
      http.post('/api/user-reports', () => HttpResponse.json({
        ok: false,
        error: {
          code: 'bad_request',
          message: 'title is required',
        },
      }, { status: 400 })),
    );

    render(
      <MemoryRouter>
        <UserReportSubmissionPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /titolo/i }), { target: { value: 'Bad report' } });
    fireEvent.change(screen.getByRole('textbox', { name: /descrizione/i }), { target: { value: 'Bad desc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('title is required');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
