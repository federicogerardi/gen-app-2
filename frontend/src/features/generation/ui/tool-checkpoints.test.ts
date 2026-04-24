import { describe, expect, it } from 'vitest';
import {
  selectBestCheckpointForProject,
  shouldRequireBriefingForResume,
  sortCheckpointsForResume,
  type ToolCheckpoint,
} from './tool-checkpoints';

const checkpoint = (
  overrides: Partial<ToolCheckpoint>,
): ToolCheckpoint => ({
  artifactId: 'art-1',
  projectId: 'project-1',
  status: 'completed',
  extractionContextAvailable: true,
  model: 'openrouter:auto',
  workflowType: 'meta_ads',
  toolKey: 'meta_ads',
  contentPreview: 'preview',
  updatedAt: '2026-04-24T10:00:00.000Z',
  ...overrides,
});

describe('tool checkpoints', () => {
  it('sorts by resume priority then recency', () => {
    const sorted = sortCheckpointsForResume([
      checkpoint({ artifactId: 'art-completed', status: 'completed', updatedAt: '2026-04-24T10:00:00.000Z' }),
      checkpoint({ artifactId: 'art-partial', status: 'completed_partial', updatedAt: '2026-04-24T09:00:00.000Z' }),
      checkpoint({ artifactId: 'art-generating', status: 'generating', updatedAt: '2026-04-24T08:00:00.000Z' }),
    ]);

    expect(sorted.map((item) => item.artifactId)).toEqual([
      'art-generating',
      'art-partial',
      'art-completed',
    ]);
  });

  it('selects best checkpoint for project only', () => {
    const selected = selectBestCheckpointForProject([
      checkpoint({ artifactId: 'a1', projectId: 'project-1', status: 'completed' }),
      checkpoint({ artifactId: 'a2', projectId: 'project-1', status: 'completed_partial' }),
      checkpoint({ artifactId: 'a3', projectId: 'project-2', status: 'generating' }),
    ], 'project-1');

    expect(selected?.artifactId).toBe('a2');
  });

  it('requires new briefing when checkpoint has no extraction context', () => {
    expect(shouldRequireBriefingForResume({ extractionContextAvailable: false })).toBe(true);
    expect(shouldRequireBriefingForResume({ extractionContextAvailable: true })).toBe(false);
    expect(shouldRequireBriefingForResume(null)).toBe(true);
  });
});
