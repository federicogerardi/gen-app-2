import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listArtifacts, getArtifactById } from './artifacts-client';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
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
    workflowType: null,
  },
  ...overrides,
});

const allQuery = { type: 'all' as const, status: 'all' as const, projectId: 'all' };

describe('artifacts-client – listArtifacts', () => {
  it('returns empty array from fallback when no localArtifacts', async () => {
    const result = await listArtifacts(allQuery, { capabilities: { artifacts: false } });
    expect(result).toEqual([]);
  });

  it('applies type filter on local fallback', async () => {
    const local = [makeArtifact({ artifactType: 'content' }), makeArtifact({ artifactId: 'a2', artifactType: 'seo' })];
    const result = await listArtifacts(
      { ...allQuery, type: 'content' },
      { capabilities: { artifacts: false }, localArtifacts: local },
    );
    expect(result.every((a) => a.artifactType === 'content')).toBe(true);
  });

  it('applies status filter on local fallback', async () => {
    const local = [makeArtifact({ status: 'completed' }), makeArtifact({ artifactId: 'a2', status: 'failed' })];
    const result = await listArtifacts(
      { ...allQuery, status: 'completed' },
      { capabilities: { artifacts: false }, localArtifacts: local },
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('completed');
  });

  it('applies projectId filter on local fallback', async () => {
    const local = [makeArtifact({ projectId: 'p1' }), makeArtifact({ artifactId: 'a2', projectId: 'p2' })];
    const result = await listArtifacts(
      { ...allQuery, projectId: 'p1' },
      { capabilities: { artifacts: false }, localArtifacts: local },
    );
    expect(result.every((a) => a.projectId === 'p1')).toBe(true);
  });

  it('fetches from API when capability enabled', async () => {
    const api = [makeArtifact()];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { artifacts: api } }),
    } as Response);
    const result = await listArtifacts(allQuery, { capabilities: { artifacts: true } });
    expect(result).toEqual(api);
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
