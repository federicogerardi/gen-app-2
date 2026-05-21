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
});