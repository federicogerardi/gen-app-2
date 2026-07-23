import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useToolWorkflowJobStream } from './useToolWorkflowJobStream';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useToolWorkflowJobStream', () => {
  it('does not connect when disabled', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() =>
      useToolWorkflowJobStream({
        jobId: 'job-1',
        apiBaseUrl: '',
        onProgress: vi.fn(),
        onCompleted: vi.fn(),
        onFailed: vi.fn(),
        onCancelled: vi.fn(),
        enabled: false,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not connect when jobId is null', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() =>
      useToolWorkflowJobStream({
        jobId: null,
        apiBaseUrl: '',
        onProgress: vi.fn(),
        onCompleted: vi.fn(),
        onFailed: vi.fn(),
        onCancelled: vi.fn(),
        enabled: true,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls status before connecting to stream', async () => {
    const onCompleted = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { status: 'completed', result: { sessionId: 's1', artifactIds: ['a1'] } } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() =>
      useToolWorkflowJobStream({
        jobId: 'job-1',
        apiBaseUrl: '',
        onProgress: vi.fn(),
        onCompleted,
        onFailed: vi.fn(),
        onCancelled: vi.fn(),
        enabled: true,
      }),
    );

    await vi.waitFor(() => {
      expect(onCompleted).toHaveBeenCalledWith('s1', ['a1']);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/tools/jobs/job-1', {
      credentials: 'include',
      signal: expect.any(AbortSignal),
    });
  });

  it('dispatches onFailed when poll returns failed status', async () => {
    const onFailed = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { status: 'failed' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() =>
      useToolWorkflowJobStream({
        jobId: 'job-1',
        apiBaseUrl: '',
        onProgress: vi.fn(),
        onCompleted: vi.fn(),
        onFailed,
        onCancelled: vi.fn(),
        enabled: true,
      }),
    );

    await vi.waitFor(() => {
      expect(onFailed).toHaveBeenCalledWith('Job failed');
    });
  });

  it('dispatches onCancelled when poll returns cancelled status', async () => {
    const onCancelled = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { status: 'cancelled' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() =>
      useToolWorkflowJobStream({
        jobId: 'job-1',
        apiBaseUrl: '',
        onProgress: vi.fn(),
        onCompleted: vi.fn(),
        onFailed: vi.fn(),
        onCancelled,
        enabled: true,
      }),
    );

    await vi.waitFor(() => {
      expect(onCancelled).toHaveBeenCalled();
    });
  });
});
