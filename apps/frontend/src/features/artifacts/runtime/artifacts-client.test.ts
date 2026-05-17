import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listArtifacts, getArtifactById } from './artifacts-client';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

const makeArtifact = (overrides: Partial<GenerationArtifact> = {}): GenerationArtifact => ({
  artifactId: 'a1',
  requestId: 'r1',
  projectId: 'p1',
  artifactType: 'content',
  status: 'completed',
  model: 'gpt-4',
  toolKey: null,
  workflowType: null,
  sessionId: null,
  stepKey: null,
  artifactRole: null,
  runMode: null,
  content: 'content',
  createdAt: '2026-04-20T00:00:00.000Z',
  updatedAt: '2026-04-20T00:00:00.000Z',
  sourceRequest: {
    requestId: 'r1',
    userId: '',
    projectId: 'p1',
    artifactType: 'content',
    model: 'gpt-4',
    input: {},
    toolKey: null,
    workflowType: null,
  },
  failureReason: null,
  streamedAt: null,
  completedAt: null,
  ...overrides,
});

const allQuery = { type: 'all' as const, status: 'all' as const, projectId: 'all' };

describe('artifacts-client – listArtifacts', () => {
  it('returns empty array from fallback when no localArtifacts', async () => {
    const result = await listArtifacts(allQuery, { capabilities: { artifacts: false } });
    expect(result.artifacts).toEqual([]);
    expect(result.totalResults).toBe(0);
  });

  it('applies type filter on local fallback', async () => {
    const local = [makeArtifact({ artifactType: 'content' }), makeArtifact({ artifactId: 'a2', artifactType: 'seo' })];
    const result = await listArtifacts(
      { ...allQuery, type: 'content' },
      { capabilities: { artifacts: false }, localArtifacts: local },
    );
    expect(result.artifacts.every((a) => a.artifactType === 'content')).toBe(true);
    expect(result.totalResults).toBe(1);
  });

  it('applies status filter on local fallback', async () => {
    const local = [makeArtifact({ status: 'completed' }), makeArtifact({ artifactId: 'a2', status: 'failed' })];
    const result = await listArtifacts(
      { ...allQuery, status: 'completed' },
      { capabilities: { artifacts: false }, localArtifacts: local },
    );
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.status).toBe('completed');
    expect(result.totalResults).toBe(1);
  });

  it('applies projectId filter on local fallback', async () => {
    const local = [makeArtifact({ projectId: 'p1' }), makeArtifact({ artifactId: 'a2', projectId: 'p2' })];
    const result = await listArtifacts(
      { ...allQuery, projectId: 'p1' },
      { capabilities: { artifacts: false }, localArtifacts: local },
    );
    expect(result.artifacts.every((a) => a.projectId === 'p1')).toBe(true);
    expect(result.totalResults).toBe(1);
  });

  it('fetches from API when capability enabled', async () => {
    const api = [makeArtifact()];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { artifacts: api } }),
    } as Response);
    const result = await listArtifacts(allQuery, { capabilities: { artifacts: true } });
    expect(result.artifacts).toEqual(api);
    expect(result.totalResults).toBe(api.length);
  });

  it('maps toolKey from backend payload or request input when available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          artifacts: [
            {
              artifactId: 'a1',
              requestId: 'r1',
              projectId: 'p1',
              artifactType: 'content',
              status: 'completed',
              model: 'gpt-4',
              toolKey: 'funnel-pages',
              workflowType: 'funnel_pages',
              input: {},
              content: 'content',
              createdAt: '2026-04-20T00:00:00.000Z',
              updatedAt: '2026-04-20T00:00:00.000Z',
            },
            {
              artifactId: 'a2',
              requestId: 'r2',
              projectId: 'p1',
              artifactType: 'content',
              status: 'completed',
              model: 'gpt-4',
              workflowType: 'nextland',
              input: { toolKey: 'nextland' },
              content: 'content',
              createdAt: '2026-04-20T00:00:00.000Z',
              updatedAt: '2026-04-20T00:00:00.000Z',
            },
          ],
        },
      }),
    } as Response);

    const result = await listArtifacts(allQuery, { capabilities: { artifacts: true } });
    expect(result.artifacts[0]?.toolKey).toBe('funnel-pages');
    expect(result.artifacts[1]?.toolKey).toBe('nextland');
    expect(result.artifacts[1]?.sourceRequest.toolKey).toBe('nextland');
  });

  it('maps toolKey from workflow metadata fallback when explicit toolKey is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          artifacts: [
            {
              artifactId: 'a3',
              requestId: 'r3',
              projectId: 'p1',
              artifactType: 'content',
              status: 'completed',
              model: 'gpt-4',
              workflowType: 'funnel_pages',
              input: {
                toolWorkflow: {
                  toolKey: 'funnel-pages',
                },
              },
              content: 'content',
              createdAt: '2026-04-20T00:00:00.000Z',
              updatedAt: '2026-04-20T00:00:00.000Z',
            },
            {
              artifactId: 'a4',
              requestId: 'r4',
              projectId: 'p1',
              artifactType: 'content',
              status: 'completed',
              model: 'gpt-4',
              workflowType: 'youtube_lf_script',
              input: {},
              content: 'content',
              createdAt: '2026-04-20T00:00:00.000Z',
              updatedAt: '2026-04-20T00:00:00.000Z',
            },
          ],
        },
      }),
    } as Response);

    const result = await listArtifacts(allQuery, { capabilities: { artifacts: true } });
    expect(result.artifacts[0]?.toolKey).toBe('funnel-pages');
    expect(result.artifacts[1]?.toolKey).toBe('youtube-lf-script');
  });
});

describe('artifacts-client – getArtifactById', () => {
  it('returns artifact from localArtifacts fallback', async () => {
    const local = [makeArtifact({ artifactId: 'x1' })];
    const result = await getArtifactById('x1', { capabilities: { artifacts: false }, localArtifacts: local });
    expect(result?.artifactId).toBe('x1');
  });

  it('returns null when not found in localArtifacts', async () => {
    const result = await getArtifactById('nope', { capabilities: { artifacts: false }, localArtifacts: [] });
    expect(result).toBeNull();
  });

  it('maps detail payload from API when capability enabled', async () => {
    const detail = makeArtifact({ artifactId: 'api-1' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { artifact: detail } }),
    } as Response);

    const result = await getArtifactById('api-1', { capabilities: { artifacts: true } });
    expect(result?.artifactId).toBe('api-1');
  });
});
