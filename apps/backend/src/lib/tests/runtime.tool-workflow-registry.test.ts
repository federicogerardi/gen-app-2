import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompletedArtifactsByStep } from '../runtime/tool-workflow-registry';

test('buildCompletedArtifactsByStep uses summary stepKey without fetching detail', async () => {
  let detailCalls = 0;

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
      detailCalls += 1;
      return null;
    },
    '/api/tools/orchestrate',
    'corr-test',
  );

  assert.deepEqual(completedArtifactsByStep, {
    vsl: 'artifact-vsl-001',
    quiz: 'artifact-quiz-001',
  });
  assert.equal(detailCalls, 0);
});

test('buildCompletedArtifactsByStep falls back to detail input when summary stepKey is missing', async () => {
  let detailCalls = 0;

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
    async () => {
      detailCalls += 1;
      return {
        artifactId: 'artifact-optin-001',
        input: { toolWorkflow: { stepKey: 'optin' } },
      };
    },
    '/api/tools/orchestrate',
    'corr-test',
  );

  assert.deepEqual(completedArtifactsByStep, {
    optin: 'artifact-optin-001',
  });
  assert.equal(detailCalls, 1);
});