import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listSessions } from './session-client';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

const makeBackendArtifact = (overrides: Partial<Record<string, unknown>> = {}) => ({
  artifactId: 'artifact-1',
  requestId: 'request-1',
  projectId: 'project-1',
  artifactType: 'content',
  status: 'completed',
  model: 'openrouter/auto',
  workflowType: 'funnel_pages',
  sessionId: 'sess-1',
  stepKey: 'optin',
  artifactRole: 'step',
  runMode: 'new',
  input: {
    toolWorkflow: {
      toolKey: 'funnel-pages',
      stepKey: 'optin',
    },
  },
  content: 'content',
  createdAt: '2026-05-21T10:00:00.000Z',
  updatedAt: '2026-05-21T10:00:00.000Z',
  ...overrides,
});

describe('session-client', () => {
  it('paginates artifact fallback when sessionsList capability is unavailable', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            totalResults: 3,
            artifacts: [
              makeBackendArtifact({ artifactId: 'artifact-1', sessionId: 'sess-1' }),
              makeBackendArtifact({ artifactId: 'artifact-2', sessionId: 'sess-2', updatedAt: '2026-05-21T10:02:00.000Z' }),
            ],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            totalResults: 3,
            artifacts: [
              makeBackendArtifact({ artifactId: 'artifact-3', sessionId: 'sess-3', updatedAt: '2026-05-21T10:03:00.000Z' }),
            ],
          },
        }),
      } as Response);

    const sessions = await listSessions(
      { projectId: 'project-1' },
      {
        capabilities: {
          sessionsList: false,
          artifacts: true,
        },
      },
    );

    expect(sessions).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const firstCallUrl = mockFetch.mock.calls[0]?.[0];
    const secondCallUrl = mockFetch.mock.calls[1]?.[0];

    expect(String(firstCallUrl)).toContain('/api/artifacts?projectId=project-1&limit=200&offset=0');
    expect(String(secondCallUrl)).toContain('/api/artifacts?projectId=project-1&limit=200&offset=2');
  });
});