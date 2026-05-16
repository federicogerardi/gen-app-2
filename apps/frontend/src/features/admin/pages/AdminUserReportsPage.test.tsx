import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { useMswHandler } from '../../../test/mocks/server';
import { AdminUserReportsPage } from './AdminUserReportsPage';

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
    http.get('/api/admin/user-reports', ({ request }) => {
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const reports = [
        {
          id: 'rpt_issue_001',
          category: 'issue',
          status: 'submitted',
          title: 'Issue report',
          description: 'Issue body',
          createdBy: 'member_001',
          triagedBy: null,
          triagedAt: null,
          closedAt: null,
          createdAt: '2026-05-16T10:00:00.000Z',
          updatedAt: '2026-05-16T10:00:00.000Z',
        },
        {
          id: 'rpt_feature_001',
          category: 'feature-request',
          status: 'submitted',
          title: 'Feature report',
          description: 'Feature body',
          createdBy: 'member_002',
          triagedBy: null,
          triagedAt: null,
          closedAt: null,
          createdAt: '2026-05-16T10:05:00.000Z',
          updatedAt: '2026-05-16T10:05:00.000Z',
        },
        {
          id: 'rpt_other_001',
          category: 'other',
          status: 'submitted',
          title: 'Other report',
          description: 'Other body',
          createdBy: 'member_003',
          triagedBy: null,
          triagedAt: null,
          closedAt: null,
          createdAt: '2026-05-16T10:06:00.000Z',
          updatedAt: '2026-05-16T10:06:00.000Z',
        },
      ];

      const filtered = category ? reports.filter((item) => item.category === category) : reports;
      return HttpResponse.json({ ok: true, data: { reports: filtered } });
    }),
  );

  useMswHandler(
    http.patch('/api/admin/user-reports/:id', ({ params }) => HttpResponse.json({
      ok: true,
      data: {
        report: {
          id: String(params.id),
          category: 'issue',
          status: 'triaged',
          title: 'Issue report',
          description: 'Issue body',
          createdBy: 'member_001',
          triagedBy: 'admin_001',
          triagedAt: '2026-05-16T10:30:00.000Z',
          closedAt: null,
          createdAt: '2026-05-16T10:00:00.000Z',
          updatedAt: '2026-05-16T10:30:00.000Z',
        },
      },
    })),
  );

  useMswHandler(
    http.post('/api/admin/user-reports/:id/publish-issue', ({ params }) => HttpResponse.json({
      ok: true,
      data: {
        githubLink: {
          userReportId: String(params.id),
          repository: 'acme/platform',
          issueNumber: 99,
          issueUrl: 'https://github.com/acme/platform/issues/99',
          publishedBy: 'admin_001',
          publishedAt: '2026-05-16T10:40:00.000Z',
        },
      },
    })),
  );
});

describe('AdminUserReportsPage', () => {
  it('renders inbox as Data Table View', async () => {
    render(
      <MemoryRouter>
        <AdminUserReportsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Issue report')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Admin user reports' })).toBeInTheDocument();
  });

  it('gates issue publication action by category and allows publish for issue and feature-request rows', async () => {
    render(
      <MemoryRouter>
        <AdminUserReportsPage />
      </MemoryRouter>,
    );

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
});
