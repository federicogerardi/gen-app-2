import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompletedArtifactsByStep } from '../runtime/tool-workflow-registry';
import { canRoleAccessToolKey, getToolAvailabilityPolicy } from '@gen-app-2/contracts';

test('buildCompletedArtifactsByStep resolves brief-generator single step correctly', async () => {
  const completedArtifactsByStep = await buildCompletedArtifactsByStep(
    'user-brief-001',
    'brief-generator',
    [
      {
        artifactId: 'artifact-brief-001',
        workflowType: 'brief_generator',
        artifactType: 'content',
        stepKey: 'brief-generation',
      },
    ],
    async () => [],
    '/api/tools/orchestrate',
    'corr-brief-test',
  );

  assert.deepEqual(completedArtifactsByStep, {
    'brief-generation': 'artifact-brief-001',
  });
});

test('buildCompletedArtifactsByStep handles empty brief-generator artifacts', async () => {
  const completedArtifactsByStep = await buildCompletedArtifactsByStep(
    'user-brief-002',
    'brief-generator',
    [],
    async () => [],
    '/api/tools/orchestrate',
    'corr-brief-empty',
  );

  assert.deepEqual(completedArtifactsByStep, {});
});

test('brief-generator tool availability matches enabled-for-all policy', () => {
  const policy = getToolAvailabilityPolicy('brief-generator');
  assert.equal(policy, 'enabled-for-all');
  assert.equal(canRoleAccessToolKey('brief-generator', 'member'), true);
  assert.equal(canRoleAccessToolKey('brief-generator', 'admin'), true);
});

test('brief-generator step dependencies are correctly defined', async () => {
  const { TOOL_STEP_ORDER, TOOL_STEP_DEPENDENCIES } = await import('@gen-app-2/contracts');

  const steps = TOOL_STEP_ORDER['brief-generator'];
  assert.deepEqual(steps, ['brief-generation']);

  const deps = TOOL_STEP_DEPENDENCIES['brief-generator'];
  assert.deepEqual(deps['brief-generation'], []);
});
