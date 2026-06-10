import { describe, expect, it, vi } from 'vitest';
import { runGeneration } from './generation-client';
import type { GenerationRequest } from '../contracts/backend-stream';
import type { GenerationRunResponse } from '@gen-app-2/contracts';

describe('runGeneration', () => {
  it('returns parsed JSON response on success', async () => {
    const mockResponse: GenerationRunResponse = {
      artifactId: 'art-run-001',
      content: 'Test generated content',
      status: 'completed',
      metrics: { inputTokens: 10, outputTokens: 20, costUsd: 0.0001 },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: mockResponse }),
    } as unknown as Response);

    const request: GenerationRequest = {
      requestId: 'req-run-001',
      userId: 'user-1',
      projectId: 'project-1',
      artifactType: 'content',
      model: 'openrouter/auto',
      input: { prompt: 'test' },
      registrySnapshotRef: 'snapshot:default',
    };

    const result = await runGeneration(request, { apiBaseUrl: 'https://api.test' });

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test/generation/run',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: expect.any(String),
      }),
    );

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(callArgs[1].body);
    expect(body).toEqual(request);
  });

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as unknown as Response);

    const request: GenerationRequest = {
      requestId: 'req-run-500',
      userId: 'user-1',
      projectId: 'project-1',
      artifactType: 'content',
      model: 'openrouter/auto',
      input: { prompt: 'test' },
      registrySnapshotRef: 'snapshot:default',
    };

    await expect(runGeneration(request, { apiBaseUrl: 'https://api.test' })).rejects.toThrow(
      'HTTP 500 from generation/run',
    );
  });

  it('aborts when signal is triggered', async () => {
    global.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new Error('AbortError'));
          });
        }
      });
    });

    const request: GenerationRequest = {
      requestId: 'req-run-abort',
      userId: 'user-1',
      projectId: 'project-1',
      artifactType: 'content',
      model: 'openrouter/auto',
      input: { prompt: 'test' },
      registrySnapshotRef: 'snapshot:default',
    };

    const controller = new AbortController();
    const promise = runGeneration(request, { apiBaseUrl: 'https://api.test', signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toThrow('AbortError');
  });
});
