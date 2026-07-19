import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { createMockAuthSessionProvider } from '../../../test/mocks/auth-session-provider.mock';
import { UserReportSubmissionPage } from './UserReportSubmissionPage';

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

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), { target: { value: 'Cannot save project' } });
    fireEvent.change(screen.getByRole('textbox', { name: /description/i }), { target: { value: 'Save fails with 500.' } });
    fireEvent.click(screen.getByRole('button', { name: appCopy.editorial.feedback.userReportSubmitButton }));

    expect(await screen.findByText(appCopy.editorial.feedback.userReportSuccessMessage)).toBeInTheDocument();

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        appCopy.editorial.feedback.userReportSuccessMessage,
        expect.objectContaining({ dedupeKey: 'feedback-center:user-report:submit:success' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: appCopy.editorial.feedback.userReportBackToForm }));
    expect(screen.queryByText(appCopy.editorial.feedback.userReportSuccessMessage)).toBeNull();
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

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), { target: { value: 'Bad report' } });
    fireEvent.change(screen.getByRole('textbox', { name: /description/i }), { target: { value: 'Bad desc' } });
    fireEvent.click(screen.getByRole('button', { name: appCopy.editorial.feedback.userReportSubmitButton }));

    expect(await screen.findByRole('alert')).toHaveTextContent('title is required');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
