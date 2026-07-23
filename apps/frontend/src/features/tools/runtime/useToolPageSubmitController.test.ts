import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolPageSubmitController } from './useToolPageSubmitController';

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('useToolPageSubmitController', () => {
  const baseArgs = {
    apiBaseUrl: '',
    toolKey: 'funnel-pages' as const,
    projectId: 'project-1',
    model: 'openrouter/auto',
    intent: 'new' as const,
    toolPageSend: vi.fn(),
    extractionPayload: { schemaVersion: 'extraction.v1' },
    formState: {},
  };

  it('submitJob calls POST /api/tools/jobs with correct payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { jobId: 'job-123' } }),
    } as any);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useToolPageSubmitController(baseArgs));

    await act(async () => {
      await result.current.submitJob();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/tools/jobs', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"toolKey":"funnel-pages"'),
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body);
    expect(body.toolKey).toBe('funnel-pages');
    expect(body.projectId).toBe('project-1');
    expect(body.model).toBe('openrouter/auto');
    expect(body.intent).toBe('new');
    expect(body.extractionPayload).toEqual({ schemaVersion: 'extraction.v1' });
    expect(body.idempotencyKey).toBeTruthy();
  });

  it('submitJob dispatches SUBMIT_JOB on success', async () => {
    const toolPageSend = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { jobId: 'job-123' } }),
    } as any));

    const { result } = renderHook(() =>
      useToolPageSubmitController({ ...baseArgs, toolPageSend }),
    );

    await act(async () => {
      await result.current.submitJob();
    });

    expect(toolPageSend).toHaveBeenCalledWith({ type: 'SUBMIT_JOB', jobId: 'job-123' });
  });

  it('submitJob dispatches JOB_FAILED on HTTP error', async () => {
    const toolPageSend = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, error: { message: 'Invalid payload' } }),
    } as any));

    const { result } = renderHook(() =>
      useToolPageSubmitController({ ...baseArgs, toolPageSend }),
    );

    await act(async () => {
      await result.current.submitJob();
    });

    expect(toolPageSend).toHaveBeenCalledWith({
      type: 'JOB_FAILED',
      reason: 'Invalid payload',
    });
  });

  it('submitJob dispatches JOB_FAILED when extractionPayload is missing', async () => {
    const toolPageSend = vi.fn();

    const { result } = renderHook(() =>
      useToolPageSubmitController({
        ...baseArgs,
        toolPageSend,
        extractionPayload: null,
        formState: {
          baseQuery: '', language: '', country: '', brandName: '',
          videoTitle: '', topic: '', keywords: '', titolo: '',
          ctaText: '', ctaLink: '', credentialsOrProof: '',
          chaptersWithTimestamps: '', socialLinks: '', hashtags: '',
        },
      }),
    );

    await act(async () => {
      await result.current.submitJob();
    });

    expect(toolPageSend).toHaveBeenCalledWith({
      type: 'JOB_FAILED',
      reason: 'Missing extraction context',
    });
  });

  it('submitJob persists jobId in sessionStorage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { jobId: 'job-456' } }),
    } as any));

    const { result } = renderHook(() => useToolPageSubmitController(baseArgs));

    await act(async () => {
      await result.current.submitJob();
    });

    expect(sessionStorage.getItem('tool-job:project-1:funnel-pages')).toBe('job-456');
  });

  it('idempotencyKey is stable across calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { jobId: 'job-1' } }),
    } as any));

    const { result } = renderHook(() => useToolPageSubmitController(baseArgs));

    await act(async () => {
      await result.current.submitJob();
    });

    const firstKey = JSON.parse((fetch as any).mock.calls[0][1].body).idempotencyKey;

    (fetch as any).mockClear();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { jobId: 'job-2' } }),
    } as any);

    await act(async () => {
      await result.current.submitJob();
    });

    const secondKey = JSON.parse((fetch as any).mock.calls[0][1].body).idempotencyKey;
    expect(firstKey).toBe(secondKey);
  });
});
