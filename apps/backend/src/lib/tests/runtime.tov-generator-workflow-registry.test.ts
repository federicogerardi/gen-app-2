import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompletedArtifactsByStep } from '../runtime/tool-workflow-registry';
import { canRoleAccessToolKey, getToolAvailabilityPolicy } from '@gen-app-2/contracts';

test('buildCompletedArtifactsByStep resolves tov-generator single step correctly', async () => {
  const completedArtifactsByStep = await buildCompletedArtifactsByStep(
    'user-tov-001',
    'tov-generator',
    [
      {
        artifactId: 'artifact-tov-001',
        workflowType: 'tov_generator',
        artifactType: 'content',
        stepKey: 'tov-generation',
      },
    ],
    async () => [],
    '/api/tools/orchestrate',
    'corr-tov-test',
  );

  assert.deepEqual(completedArtifactsByStep, {
    'tov-generation': 'artifact-tov-001',
  });
});

test('buildCompletedArtifactsByStep handles empty tov-generator artifacts', async () => {
  const completedArtifactsByStep = await buildCompletedArtifactsByStep(
    'user-tov-002',
    'tov-generator',
    [],
    async () => [],
    '/api/tools/orchestrate',
    'corr-tov-empty',
  );

  assert.deepEqual(completedArtifactsByStep, {});
});

test('tov-generator tool availability matches enabled-for-all policy', () => {
  const policy = getToolAvailabilityPolicy('tov-generator');
  assert.equal(policy, 'enabled-for-all');
  assert.equal(canRoleAccessToolKey('tov-generator', 'member'), true);
  assert.equal(canRoleAccessToolKey('tov-generator', 'admin'), true);
});

test('tov-generator step dependencies are correctly defined', async () => {
  const { TOOL_STEP_ORDER, TOOL_STEP_DEPENDENCIES } = await import('@gen-app-2/contracts');

  const steps = TOOL_STEP_ORDER['tov-generator'];
  assert.deepEqual(steps, ['tov-generation']);

  const deps = TOOL_STEP_DEPENDENCIES['tov-generator'];
  assert.deepEqual(deps['tov-generation'], []);
});
