import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { useMswHandlers } from '../../../test/mocks/server';
import { renderAdminPage } from '../test/renderAdminPage';
import { buildChangelogHandlers } from '../test/msw-admin-factories';
import { getMockAuthSession, resetMockAdminSession } from '../test/mockAdminSession';
import { AdminChangelogPage } from './AdminChangelogPage';

const feedbackApiSpy = vi.hoisted(() => ({
  publishSuccess: vi.fn(),
  publishError: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
}));

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => getMockAuthSession(),
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
    expect(screen.getByRole('heading', { name: 'Admin changelog' })).toBeInTheDocument();
  });

  it('publishes changelog and emits global success feedback', async () => {
    renderAdminPage(<AdminChangelogPage />);

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

  it('emits global error feedback when publish changelog fails', async () => {
    useMswHandlers(
      http.post('/api/admin/changelog', () => new HttpResponse(null, { status: 500 })),
    );

    renderAdminPage(<AdminChangelogPage />);

    await screen.findByText('Release 1.0');

    fireEvent.change(screen.getByRole('textbox', { name: /titolo/i }), { target: { value: 'Release failure' } });
    fireEvent.change(screen.getByRole('textbox', { name: /contenuto/i }), { target: { value: 'Broken publish' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pubblica changelog' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishError).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dedupeKey: 'admin-changelog:publish:error' }),
      );
    });
  });

  it('archives a published changelog entry and emits global success feedback', async () => {
    renderAdminPage(<AdminChangelogPage />);

    const titleCell = await screen.findByText('Release 1.0');
    const row = titleCell.closest('tr');
    expect(row).not.toBeNull();

    const archiveButton = (row as HTMLElement).querySelector('button');
    expect(archiveButton).not.toBeNull();

    fireEvent.click(archiveButton as HTMLElement);

    await waitFor(() => {
      expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
        'Voce changelog archiviata.',
        expect.objectContaining({ dedupeKey: 'admin-changelog:archive:chg_001:success' }),
      );
    });
  });
});
