import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompletedArtifactsByStep } from '../runtime/tool-workflow-registry';

test('buildCompletedArtifactsByStep uses summary stepKey without fetching detail', async () => {
  let batchCalls = 0;

  const completedArtifactsByStep = await buildCompletedArtifactsByStep(
    'user-001',
    'funnel-pages',
    [
      {
        artifactId: 'artifact-vsl-001',
        workflowType: 'funnel_pages',
        artifactType: 'content',
        stepKey: 'vsl',
      },
      {
        artifactId: 'artifact-quiz-001',
        workflowType: 'funnel_pages',
        artifactType: 'content',
        stepKey: 'quiz',
      },
    ],
    async () => {
      batchCalls += 1;
      return [];
    },
    '/api/tools/orchestrate',
    'corr-test',
  );

  assert.deepEqual(completedArtifactsByStep, {
    vsl: 'artifact-vsl-001',
    quiz: 'artifact-quiz-001',
  });
  assert.equal(batchCalls, 0);
});

test('buildCompletedArtifactsByStep falls back to batch detail input when summary stepKey is missing', async () => {
  let batchCalls = 0;

  const completedArtifactsByStep = await buildCompletedArtifactsByStep(
    'user-001',
    'funnel-pages',
    [
      {
        artifactId: 'artifact-optin-001',
        workflowType: 'funnel_pages',
        artifactType: 'content',
      },
    ],
    async (userId, artifactIds) => {
      batchCalls += 1;
      assert.equal(userId, 'user-001');
      assert.deepEqual(artifactIds, ['artifact-optin-001']);
      return [
        {
          artifactId: 'artifact-optin-001',
          input: { toolWorkflow: { stepKey: 'optin' } },
        },
      ];
    },
    '/api/tools/orchestrate',
    'corr-test',
  );

  assert.deepEqual(completedArtifactsByStep, {
    optin: 'artifact-optin-001',
  });
  assert.equal(batchCalls, 1);
});

test('buildCompletedArtifactsByStep keeps deterministic first-hit behavior with mixed summary and detail fallback', async () => {
  let batchCalls = 0;

  const completedArtifactsByStep = await buildCompletedArtifactsByStep(
    'user-001',
    'funnel-pages',
    [
      {
        artifactId: 'artifact-optin-new',
        workflowType: 'funnel_pages',
        artifactType: 'content',
      },
      {
        artifactId: 'artifact-optin-old',
        workflowType: 'funnel_pages',
        artifactType: 'content',
      },
      {
        artifactId: 'artifact-quiz-summary',
        workflowType: 'funnel_pages',
        artifactType: 'content',
        stepKey: 'quiz',
      },
      {
        artifactId: 'artifact-extraction-ignored',
        workflowType: 'funnel_pages',
        artifactType: 'extraction',
        stepKey: 'optin',
      },
      {
        artifactId: 'artifact-nextland-ignored',
        workflowType: 'nextland',
        artifactType: 'content',
        stepKey: 'landing',
      },
    ],
    async (_userId, artifactIds) => {
      batchCalls += 1;
      assert.deepEqual(artifactIds, ['artifact-optin-new', 'artifact-optin-old']);
      return [
        {
          artifactId: 'artifact-optin-old',
          input: { toolWorkflow: { stepKey: 'optin' } },
        },
        {
          artifactId: 'artifact-optin-new',
          input: { toolWorkflow: { stepKey: 'optin' } },
        },
      ];
    },
    '/api/tools/orchestrate',
    'corr-test',
  );

  assert.equal(batchCalls, 1);
  assert.deepEqual(completedArtifactsByStep, {
    optin: 'artifact-optin-new',
    quiz: 'artifact-quiz-summary',
  });
});