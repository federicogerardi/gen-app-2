import test from 'node:test';
import assert from 'node:assert/strict';

import { ArtifactQueryRepositoryStub } from '../adapters/generation';
import { SessionQueryAdapter } from '../adapters/session-query.adapter';

test('SessionQueryAdapter ignores legacy artifacts without session metadata', async () => {
  const artifactQueries = new ArtifactQueryRepositoryStub();
  artifactQueries.seed([
    {
      artifactId: 'artifact-legacy-001',
      requestId: 'req-legacy-001',
      userId: 'user-legacy-001',
      projectId: 'project-legacy-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      workflowType: 'funnel_pages',
      input: {
        toolWorkflow: {
          toolKey: 'funnel-pages',
          stepKey: 'avatar',
        },
      },
      content: 'legacy content',
      failureReason: null,
      createdAt: '2026-05-08T12:00:00.000Z',
      updatedAt: '2026-05-08T12:00:00.000Z',
    },
  ]);

  const adapter = new SessionQueryAdapter(artifactQueries);

  const group = await adapter.fetchSessionArtifacts('sess-missing', 'user-legacy-001');
  assert.equal(group, null);

  const step = await adapter.fetchStepArtifact('sess-missing', 'avatar', 'user-legacy-001');
  assert.equal(step, null);
});
