import test from 'node:test';
import assert from 'node:assert/strict';

import { ArtifactQueryRepositoryStub } from '../adapters';
import { SessionQueryAdapter } from '../adapters/session-query.adapter';

test('SessionQueryAdapter aggregates artifacts by session in chronological order', async () => {
  const artifactQueries = new ArtifactQueryRepositoryStub();
  artifactQueries.seed([
    {
      artifactId: 'artifact-step-2',
      requestId: 'req-step-2',
      userId: 'user-session-001',
      projectId: 'project-session-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter:auto',
      workflowType: 'funnel-pages',
      sessionId: 'sess-001',
      stepKey: 'offer',
      artifactRole: 'step',
      runMode: 'new',
      input: {
        toolWorkflow: {
          stepKey: 'offer',
          toolKey: 'funnel-pages',
          artifactRole: 'step',
          runMode: 'new',
        },
      },
      content: 'offer content',
      failureReason: null,
      createdAt: '2026-05-08T10:01:00.000Z',
      updatedAt: '2026-05-08T10:01:00.000Z',
    },
    {
      artifactId: 'artifact-step-1',
      requestId: 'req-step-1',
      userId: 'user-session-001',
      projectId: 'project-session-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter:auto',
      workflowType: 'funnel-pages',
      sessionId: 'sess-001',
      stepKey: 'avatar',
      artifactRole: 'step',
      runMode: 'new',
      input: {
        toolWorkflow: {
          stepKey: 'avatar',
          toolKey: 'funnel-pages',
          artifactRole: 'step',
          runMode: 'new',
        },
      },
      content: 'avatar content',
      failureReason: null,
      createdAt: '2026-05-08T10:00:00.000Z',
      updatedAt: '2026-05-08T10:00:00.000Z',
    },
    {
      artifactId: 'artifact-other-session',
      requestId: 'req-other',
      userId: 'user-session-001',
      projectId: 'project-session-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter:auto',
      workflowType: 'funnel-pages',
      sessionId: 'sess-002',
      stepKey: 'hook',
      artifactRole: 'step',
      runMode: 'new',
      input: {
        toolWorkflow: {
          stepKey: 'hook',
          toolKey: 'funnel-pages',
          artifactRole: 'step',
          runMode: 'new',
        },
      },
      content: 'other session content',
      failureReason: null,
      createdAt: '2026-05-08T10:02:00.000Z',
      updatedAt: '2026-05-08T10:02:00.000Z',
    },
  ]);

  const adapter = new SessionQueryAdapter(artifactQueries);
  const group = await adapter.fetchSessionArtifacts('sess-001', 'user-session-001');

  assert.ok(group);
  assert.equal(group.sessionId, 'sess-001');
  assert.equal(group.toolKey, 'funnel-pages');
  assert.equal(group.status, 'completed');
  assert.deepEqual(
    group.artifacts.map((artifact) => artifact.stepKey),
    ['avatar', 'offer'],
  );
});

test('SessionQueryAdapter resolves status precedence generating > failed > completed', async () => {
  const artifactQueries = new ArtifactQueryRepositoryStub();
  artifactQueries.seed([
    {
      artifactId: 'artifact-generating',
      requestId: 'req-generating',
      userId: 'user-session-002',
      projectId: 'project-session-002',
      artifactType: 'content',
      status: 'generating',
      model: 'openrouter:auto',
      workflowType: 'youtube-lf-script',
      sessionId: 'sess-status',
      stepKey: 'hook',
      artifactRole: 'step',
      runMode: 'resume',
      input: {
        toolWorkflow: {
          stepKey: 'hook',
          toolKey: 'youtube-lf-script',
        },
      },
      content: 'partial',
      failureReason: null,
      createdAt: '2026-05-08T11:00:00.000Z',
      updatedAt: '2026-05-08T11:00:00.000Z',
    },
    {
      artifactId: 'artifact-failed',
      requestId: 'req-failed',
      userId: 'user-session-002',
      projectId: 'project-session-002',
      artifactType: 'content',
      status: 'failed',
      model: 'openrouter:auto',
      workflowType: 'youtube-lf-script',
      sessionId: 'sess-status',
      stepKey: 'cta',
      artifactRole: 'step',
      runMode: 'resume',
      input: {
        toolWorkflow: {
          stepKey: 'cta',
          toolKey: 'youtube-lf-script',
        },
      },
      content: '',
      failureReason: 'llm_timeout',
      createdAt: '2026-05-08T11:01:00.000Z',
      updatedAt: '2026-05-08T11:01:00.000Z',
    },
  ]);

  const adapter = new SessionQueryAdapter(artifactQueries);
  const group = await adapter.fetchSessionArtifacts('sess-status', 'user-session-002');

  assert.ok(group);
  assert.equal(group.status, 'generating');

  const stepArtifact = await adapter.fetchStepArtifact('sess-status', 'cta', 'user-session-002');
  assert.ok(stepArtifact);
  assert.equal(stepArtifact.status, 'failed');
  assert.equal(stepArtifact.failureReason, 'llm_timeout');
});
