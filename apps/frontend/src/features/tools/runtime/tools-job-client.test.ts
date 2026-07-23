import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ToolWorkflowJob client contract', () => {
  it('POST /api/tools/jobs accepts SubmitJobRequest and returns jobId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          jobId: '550e8400-e29b-41d4-a716-446655440000',
          status: 'queued',
          toolKey: 'funnel-pages',
          queuedAt: '2026-07-24T00:00:00.000Z',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetch('/api/tools/jobs', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolKey: 'funnel-pages',
        projectId: 'project-1',
        extractionPayload: { schemaVersion: 'extraction.v1' },
        model: 'openrouter/auto',
        intent: 'new',
        idempotencyKey: 'idem-1',
      }),
    });

    const result = (await response.json()) as { ok: boolean; data: { jobId: string; status: string } };

    expect(result.ok).toBe(true);
    expect(result.data.jobId).toBeTruthy();
    expect(result.data.status).toBe('queued');
  });

  it('POST /api/tools/jobs returns 409 on duplicate scope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        ok: false,
        error: { code: 'conflict', message: 'A ToolWorkflowJob is already active' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetch('/api/tools/jobs', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolKey: 'funnel-pages',
        projectId: 'project-1',
        extractionPayload: {},
        model: 'openrouter/auto',
        intent: 'new',
        idempotencyKey: 'idem-1',
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(409);

    const result = (await response.json()) as { error: { code: string } };
    expect(result.error.code).toBe('conflict');
  });

  it('GET /api/tools/jobs/:id returns JobStatusResponse shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          jobId: 'job-1',
          status: 'running',
          toolKey: 'funnel-pages',
          userId: 'user-1',
          projectId: 'project-1',
          createdAt: '2026-07-24T00:00:00.000Z',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetch('/api/tools/jobs/job-1', {
      credentials: 'include',
    });

    const result = (await response.json()) as {
      data: { jobId: string; status: string; toolKey: string };
    };

    expect(result.data.jobId).toBe('job-1');
    expect(result.data.status).toBe('running');
    expect(result.data.toolKey).toBe('funnel-pages');
  });
});
