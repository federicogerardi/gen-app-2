import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { appCopy } from '../../../app/copy/system';
import { useMswHandlers } from '../../../test/mocks/server';
import { renderAdminPage } from '../test/renderAdminPage';
import { buildChangelogHandlers } from '../test/msw-admin-factories';
import { getMockAuthSession, resetMockAdminSession } from '../test/mockAdminSession';
import { AdminChangelogPage } from './AdminChangelogPage';

import { createFeedbackApiSpy } from '../../../test/mocks/feedback-message-spy.mock';
const feedbackApiSpy = createFeedbackApiSpy();

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
      adminChangelogArchive: true,
      adminUserReportsList: true,
      adminUserReportsUpdate: true,
      adminUserReportsPublishIssue: true,
    },
  });

  useMswHandlers(...buildChangelogHandlers());
});

describe('AdminChangelogPage', () => {
  it('renders published changelog table', async () => {
    renderAdminPage(<AdminChangelogPage />);

    expect(await screen.findByText('Release 1.0')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: appCopy.editorial.admin.changelogTitle })).toBeInTheDocument();
  });

  it.skip('publishes changelog and emits global success feedback', async () => {
    renderAdminPage(<AdminChangelogPage />);

    await screen.findByText('Release 1.0');

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), { target: { value: 'Release 1.1' } });
    fireEvent.change(screen.getByRole('textbox', { name: /content/i }), { target: { value: 'Patch release' } });
    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.adminChangelog.submitLabel }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminChangelogPublished,
        expect.objectContaining({ dedupeKey: 'admin-changelog:publish:success' }),
      );
    });
  });

  it('emits global error feedback when publish changelog fails', async () => {
    useMswHandlers(
      http.post('/api/admin/changelog', () => new HttpResponse(null, { status: 500 })),
    );

    renderAdminPage(<AdminChangelogPage />);

    await screen.findByText('Release 1.0');

    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), { target: { value: 'Release failure' } });
    fireEvent.change(screen.getByRole('textbox', { name: /content/i }), { target: { value: 'Broken publish' } });
    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.adminChangelog.submitLabel }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishError).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dedupeKey: 'admin-changelog:publish:error' }),
      );
    });
  });

  it.skip('archives a published changelog entry and emits global success feedback', async () => {
    renderAdminPage(<AdminChangelogPage />);

    const titleCell = await screen.findByText('Release 1.0');
    const row = titleCell.closest('tr');
    expect(row).not.toBeNull();

    const archiveButton = (row as HTMLElement).querySelector('button');
    expect(archiveButton).not.toBeNull();

    fireEvent.click(archiveButton as HTMLElement);

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminChangelogArchived,
        expect.objectContaining({ dedupeKey: 'admin-changelog:archive:chg_001:success' }),
      );
    });
  });
});
