import { http, HttpResponse } from 'msw';

export const buildChangelogHandlers = () => {
  let changelog = [
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
  ];

  return [
    http.get('/api/changelog', () => HttpResponse.json({
      ok: true,
      data: {
        changelog,
      },
    })),

    http.post('/api/admin/changelog', () => {
      const created = {
          id: 'chg_002',
          title: 'Release 1.1',
          body: 'Patch release',
          status: 'published',
          createdBy: 'admin_001',
          publishedBy: 'admin_001',
          publishedAt: '2026-05-16T12:30:00.000Z',
          createdAt: '2026-05-16T12:30:00.000Z',
          updatedAt: '2026-05-16T12:30:00.000Z',
      };
      changelog = [...changelog, created];

      return HttpResponse.json({
        ok: true,
        data: {
          changelog: created,
        },
      }, { status: 201 });
    }),

    http.patch('/api/admin/product-changelogs/:id/archive', ({ params }) => {
      const id = String(params.id);
      changelog = changelog.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }

        return {
          ...entry,
          status: 'draft',
          updatedAt: '2026-05-16T13:00:00.000Z',
        };
      });

      const archived = changelog.find((entry) => entry.id === id);
      if (!archived) {
        return new HttpResponse(null, { status: 404 });
      }

      return HttpResponse.json({
        ok: true,
        data: {
          changelog: archived,
        },
      });
    }),
  ];
};

export const buildUserReportsHandlers = () => {
  type TestUserReport = {
    id: string;
    category: string;
    status: string;
    title: string;
    description: string;
    createdBy: string;
    triagedBy: string | null;
    triagedAt: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };

  let reports: TestUserReport[] = [
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

  return [
    http.get('/api/admin/user-reports', ({ request }) => {
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const filtered = category ? reports.filter((item) => item.category === category) : reports;
      return HttpResponse.json({ ok: true, data: { reports: filtered } });
    }),

    http.patch('/api/admin/user-reports/:id', async ({ params, request }) => {
      const id = String(params.id);
      const body = await request.json() as { status?: 'triaged' | 'closed' };
      const nextStatus = body.status ?? 'triaged';

      reports = reports.map((report) => {
        if (report.id !== id) {
          return report;
        }

        return {
          ...report,
          status: nextStatus,
          triagedBy: nextStatus === 'triaged' ? 'admin_001' : report.triagedBy,
          triagedAt: nextStatus === 'triaged' ? '2026-05-16T10:30:00.000Z' : report.triagedAt,
          closedAt: nextStatus === 'closed' ? '2026-05-16T10:45:00.000Z' : report.closedAt,
          updatedAt: nextStatus === 'closed' ? '2026-05-16T10:45:00.000Z' : '2026-05-16T10:30:00.000Z',
        };
      });

      const updated = reports.find((report) => report.id === id);
      if (!updated) {
        return new HttpResponse(null, { status: 404 });
      }

      return HttpResponse.json({
        ok: true,
        data: {
          report: updated,
        },
      });
    }),

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
  ];
};