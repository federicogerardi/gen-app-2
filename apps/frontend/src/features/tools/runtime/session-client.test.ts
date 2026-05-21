import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStepArtifact, listSessions } from './session-client';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

describe('session-client', () => {
  it('fails closed when sessionsList capability is unavailable', async () => {
    await expect(
      listSessions(
        { projectId: 'project-1' },
        {
          capabilities: {
            sessionsList: false,
            artifacts: true,
          },
        },
      ),
    ).rejects.toThrow('Session listing unavailable: enable sessionsList capability or upgrade backend support');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fails closed for step artifact when sessionsDetail capability is unavailable', async () => {
    await expect(
      getStepArtifact(
        'sess-1',
        'optin',
        {
          capabilities: {
            sessionsDetail: false,
          },
        },
      ),
    ).rejects.toThrow('Session endpoint unavailable: enable sessionsDetail capability or upgrade backend support');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('builds step artifact endpoint via centralized api paths', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          artifact: {
            artifactId: 'artifact-1',
            requestId: 'request-1',
            projectId: 'project-1',
            stepKey: 'optin',
            artifactRole: 'step',
            runMode: 'new',
            status: 'completed',
            content: 'content',
            failureReason: null,
            updatedAt: '2026-05-21T10:00:00.000Z',
            workflowType: 'funnel_pages',
            toolKey: 'funnel-pages',
          },
        },
      }),
    });

    const artifact = await getStepArtifact('sess 1', 'step/one', {
      capabilities: {
        sessionsDetail: true,
      },
    });

    expect(artifact.artifactId).toBe('artifact-1');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/tools/sessions/sess%201/step/step%2Fone?includeContent=1',
      {
        method: 'GET',
        credentials: 'include',
      },
    );
  });
});