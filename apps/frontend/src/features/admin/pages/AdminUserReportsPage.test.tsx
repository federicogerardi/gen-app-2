import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { useMswHandlers } from '../../../test/mocks/server';
import { renderAdminPage } from '../test/renderAdminPage';
import { buildUserReportsHandlers } from '../test/msw-admin-factories';
import { getMockAuthSession, resetMockAdminSession } from '../test/mockAdminSession';
import { AdminUserReportsPage } from './AdminUserReportsPage';

const feedbackApiSpy = vi.hoisted(() => ({
  publishSuccess: vi.fn(),
  publishError: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
}));

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => getMockAuthSession(),
  useAuthState: () => {
    const auth = getMockAuthSession();
    return { session: auth.session, loading: auth.loading, hasError: auth.hasError };
  },
  useAuthActions: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    clearError: () => {},
  }),
  useApiConfig: () => {
    const auth = getMockAuthSession();
    return { apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities };
  },
  useOAuthUrl: () => ({
    oauthStartUrl: '',
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

  resetMockAdminSession({
    role: 'admin',
    userId: 'admin_001',
    email: 'admin@test.com',
    capabilities: {
      changelogList: true,
      userReportsCreate: true,
      adminChangelogCreate: true,
      adminUserReportsList: true,
      adminUserReportsUpdate: true,
      adminUserReportsPublishIssue: true,
    },
  });

  useMswHandlers(...buildUserReportsHandlers());
});

describe('AdminUserReportsPage', () => {
  it('renders inbox as Data Table View', async () => {
    renderAdminPage(<AdminUserReportsPage />);

    expect(await screen.findByText('Issue report')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Admin user reports' })).toBeInTheDocument();
  });

  it('gates issue publication action by category and allows publish for issue and feature-request rows', async () => {
    renderAdminPage(<AdminUserReportsPage />);

    const issueCell = await screen.findByText('Issue report');
    const issueRow = issueCell.closest('tr');
    expect(issueRow).not.toBeNull();

    const triageButton = within(issueRow as HTMLElement).getByRole('button', { name: 'Triage' });
    const issuePublishButton = within(issueRow as HTMLElement).getByRole('button', { name: 'Pubblica issue' });
    expect(issuePublishButton).toBeEnabled();

    fireEvent.click(triageButton);
    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        'Report triaged aggiornato.',
        expect.objectContaining({ dedupeKey: 'admin-user-reports:triaged:rpt_issue_001:success' }),
      );
    });

    fireEvent.click(issuePublishButton);
    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        'Issue GitHub pubblicata.',
        expect.objectContaining({ dedupeKey: 'admin-user-reports:publish-issue:rpt_issue_001:success' }),
      );
    });

    const featureCell = screen.getByText('Feature report');
    const featureRow = featureCell.closest('tr');
    expect(featureRow).not.toBeNull();
    const featurePublishButton = within(featureRow as HTMLElement).getByRole('button', { name: 'Pubblica issue' });
    expect(featurePublishButton).toBeEnabled();

    const otherCell = screen.getByText('Other report');
    const otherRow = otherCell.closest('tr');
    expect(otherRow).not.toBeNull();
    const otherPublishButton = within(otherRow as HTMLElement).getByRole('button', { name: 'Pubblica issue' });
    expect(otherPublishButton).toBeDisabled();
  });

  it('closes a report and emits global success feedback for closed transition', async () => {
    renderAdminPage(<AdminUserReportsPage />);

    const issueCell = await screen.findByText('Issue report');
    const issueRow = issueCell.closest('tr');
    expect(issueRow).not.toBeNull();

    const closeButton = within(issueRow as HTMLElement).getByRole('button', { name: 'Chiudi' });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        'Report closed aggiornato.',
        expect.objectContaining({ dedupeKey: 'admin-user-reports:closed:rpt_issue_001:success' }),
      );
    });

    expect(await screen.findByText('Chiusa')).toBeInTheDocument();
  });

  it('emits global error feedback when publish issue fails', async () => {
    useMswHandlers(
      http.post('/api/admin/user-reports/:id/publish-issue', () => new HttpResponse(null, { status: 500 })),
    );

    renderAdminPage(<AdminUserReportsPage />);

    const issueCell = await screen.findByText('Issue report');
    const issueRow = issueCell.closest('tr');
    expect(issueRow).not.toBeNull();

    fireEvent.click(within(issueRow as HTMLElement).getByRole('button', { name: 'Pubblica issue' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishError).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dedupeKey: 'admin-user-reports:publish-issue:rpt_issue_001:error' }),
      );
    });
  });
});
