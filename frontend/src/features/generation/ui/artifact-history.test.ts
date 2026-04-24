import { describe, expect, it } from 'vitest';
import type { GenerationRequest } from '../contracts/backend-stream';
import {
  buildRelaunchRequest,
  filterArtifacts,
  type ArtifactFilters,
  type GenerationArtifact,
} from './artifact-history';

const request: GenerationRequest = {
  requestId: 'req-seed',
  userId: 'user-1',
  projectId: 'project-1',
  artifactType: 'content',
  model: 'openrouter:auto',
  input: { prompt: 'seed' },
  toolKey: 'meta_ads',
  workflowType: 'meta_ads',
  registrySnapshotRef: 'snapshot:default',
};

const artifact = (overrides: Partial<GenerationArtifact>): GenerationArtifact => ({
  artifactId: 'art-1',
  requestId: 'req-1',
  projectId: 'project-1',
  artifactType: 'content',
  status: 'completed',
  model: 'openrouter:auto',
  toolKey: 'meta_ads',
  workflowType: 'meta_ads',
  content: 'hello',
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-20T10:00:00.000Z',
  sourceRequest: request,
  ...overrides,
});

describe('artifact history', () => {
  it('filters artifacts by type/status/project/period', () => {
    const all = [
      artifact({ artifactId: 'a1', artifactType: 'content', status: 'completed', projectId: 'project-1', updatedAt: '2026-04-24T09:00:00.000Z' }),
      artifact({ artifactId: 'a2', artifactType: 'seo', status: 'failed', projectId: 'project-2', updatedAt: '2026-03-10T09:00:00.000Z' }),
      artifact({ artifactId: 'a3', artifactType: 'code', status: 'generating', projectId: 'project-1', updatedAt: '2026-04-24T08:00:00.000Z' }),
    ];

    const filters: ArtifactFilters = {
      type: 'content',
      status: 'completed',
      projectId: 'project-1',
      period: '7d',
    };

    const filtered = filterArtifacts(all, filters, '2026-04-24T10:00:00.000Z');
    expect(filtered.map((item) => item.artifactId)).toEqual(['a1']);
  });

  it('builds relaunch request preserving source and adding relaunch metadata', () => {
    const sourceArtifact = artifact({
      artifactId: 'art-relaunch',
      sourceRequest: {
        ...request,
        idempotencyKey: 'idem-1',
      },
    });

    const relaunch = buildRelaunchRequest(sourceArtifact, 'secondary');
    expect(relaunch.requestId).not.toBe(sourceArtifact.sourceRequest.requestId);
    expect(relaunch.idempotencyKey).toBeUndefined();
    expect(relaunch.input['relaunchFromArtifactId']).toBe('art-relaunch');
    expect(relaunch.input['relaunchMode']).toBe('secondary');
  });
});
