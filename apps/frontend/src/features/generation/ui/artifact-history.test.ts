import { describe, expect, it } from 'vitest';
import type { GenerationRequest } from '../contracts/backend-stream';
import {
  buildArtifactEntryQuery,
  buildRelaunchRequest,
  buildToolEntryPathFromArtifact,
  filterArtifacts,
  type ArtifactFilters,
  type GenerationArtifact,
} from './artifact-history';

const request: GenerationRequest = {
  requestId: 'req-seed',
  userId: 'user-1',
  projectId: 'project-1',
  artifactType: 'content',
  model: 'openrouter/auto',
  input: { prompt: 'seed' },
  toolKey: 'funnel-pages',
  workflowType: 'funnel_pages',
  registrySnapshotRef: 'snapshot:default',
};

const artifact = (overrides: Partial<GenerationArtifact>): GenerationArtifact => ({
  artifactId: 'art-1',
  requestId: 'req-1',
  projectId: 'project-1',
  artifactType: 'content',
  status: 'completed',
  model: 'openrouter/auto',
  toolKey: 'funnel-pages',
  workflowType: 'funnel_pages',
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

    const relaunch = buildRelaunchRequest(sourceArtifact);
    expect(relaunch.requestId).not.toBe(sourceArtifact.sourceRequest.requestId);
    expect(relaunch.idempotencyKey).toBeUndefined();
    expect(relaunch.input.relaunchFromArtifactId).toBe('art-relaunch');
  });

  it('builds tool entry query with required and optional relaunch fields', () => {
    const sourceArtifact = artifact({
      artifactId: 'art-route',
      projectId: 'project-42',
      sourceRequest: {
        ...request,
        input: {
          prompt: 'seed',
          tone: 'Formal',
          notes: 'keep CTA concise',
          briefingId: 'brief-42',
          briefingFileName: 'brief.md',
        },
      },
    });

    const query = new URLSearchParams(buildArtifactEntryQuery(sourceArtifact, 'resume'));

    expect(query.get('intent')).toBe('resume');
    expect(query.get('projectId')).toBe('project-42');
    expect(query.get('sourceArtifactId')).toBe('art-route');
    expect(query.get('relaunchFromArtifactId')).toBe('art-route');
    expect(query.get('tone')).toBe('Formal');
    expect(query.get('notes')).toBe('keep CTA concise');
    expect(query.get('briefingId')).toBe('brief-42');
    expect(query.get('briefingFileName')).toBe('brief.md');
  });

  it('builds tool entry query for new relaunch intent preserving sourceArtifactId and brief references', () => {
    const sourceArtifact = artifact({
      artifactId: 'art-new-route',
      projectId: 'project-99',
      sourceRequest: {
        ...request,
        input: {
          prompt: 'seed',
          tone: 'Formal',
          notes: 'stale note',
          briefingId: 'brief-stale',
          extractionArtifactId: 'ext-stale',
          briefingFileName: 'brief-stale.md',
        },
      },
    });

    const query = new URLSearchParams(buildArtifactEntryQuery(sourceArtifact, 'new'));

    expect(query.get('intent')).toBe('new');
    expect(query.get('projectId')).toBe('project-99');
    expect(query.get('sourceArtifactId')).toBe('art-new-route');
    expect(query.get('briefingId')).toBe('brief-stale');
    expect(query.get('extractionArtifactId')).toBe('ext-stale');
    expect(query.get('relaunchFromArtifactId')).toBeNull();
    expect(query.get('tone')).toBeNull();
    expect(query.get('notes')).toBeNull();
    expect(query.get('briefingFileName')).toBeNull();
  });

  it('builds tool entry path only for supported tool routes', () => {
    const supported = artifact({
      artifactId: 'art-supported',
      toolKey: 'funnel-pages',
      sourceRequest: {
        ...request,
        toolKey: 'funnel-pages',
      },
    });

    const unsupported = artifact({
      artifactId: 'art-unsupported',
      toolKey: 'extraction',
      workflowType: 'extraction',
      sourceRequest: {
        ...request,
        toolKey: 'extraction',
        workflowType: 'extraction',
      },
    });

    const supportedPath = buildToolEntryPathFromArtifact(supported, 'regenerate');
    expect(supportedPath?.startsWith('/tools/funnel-pages?')).toBe(true);
    const youtubeSupportedPath = buildToolEntryPathFromArtifact(
      artifact({
        artifactId: 'art-supported-youtube',
        toolKey: 'youtube-lf-script',
        workflowType: 'youtube_lf_script',
        sourceRequest: {
          ...request,
          toolKey: 'youtube-lf-script',
          workflowType: 'youtube_lf_script',
        },
      }),
      'regenerate',
    );
    expect(youtubeSupportedPath?.startsWith('/tools/youtube-lf-script?')).toBe(true);
    expect(buildToolEntryPathFromArtifact(unsupported, 'resume')).toBeNull();
  });

  it('builds deterministic tool entry path for new intent', () => {
    const supported = artifact({
      artifactId: 'art-supported-new',
      projectId: 'project-clean',
      toolKey: 'funnel-pages',
      sourceRequest: {
        ...request,
        toolKey: 'funnel-pages',
        input: {
          prompt: 'seed',
          tone: 'Formal',
          notes: 'carry-over',
          briefingId: 'brief-1',
          extractionArtifactId: 'ext-1',
          briefingFileName: 'brief-1.md',
        },
      },
    });

    expect(buildToolEntryPathFromArtifact(supported, 'new')).toBe('/tools/funnel-pages?intent=new&projectId=project-clean&sourceArtifactId=art-supported-new&briefingId=brief-1&extractionArtifactId=ext-1');
  });
});
