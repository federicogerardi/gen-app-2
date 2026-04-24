import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRequestReceivedEvent } from '../runtime/request-contract';
import { resolveToolPrompt } from '../runtime/tool-prompts';

test('resolveToolPrompt loads funnel optin prompt from markdown files', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'funnel-pages',
    workflowType: 'funnel-pages',
    artifactType: 'content',
    stepKey: 'optin',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /docs\/specifications\/tool-prompts\/hl_funnel\/prompt_optin_generator\.md$/);
  assert.match(resolved.prompt, /PROMPT OPTIN GENERATOR/);
});

test('buildRequestReceivedEvent injects resolved prompt and source when prompt is missing', () => {
  const event = buildRequestReceivedEvent({
    requestId: 'req-runtime-prompts-001',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    artifactType: 'content',
    model: 'gpt-5.3-codex',
    toolKey: 'funnel-pages',
    workflowType: 'funnel-pages',
    briefingId: 'briefing-001',
    extractionArtifactId: 'artifact-extraction-001',
    stepDependencyArtifactIds: ['artifact-step-001', 'artifact-step-002'],
    input: {
      step: 'quiz',
    },
    registrySnapshotRef: 'snapshot:runtime-prompts',
  });

  const input = event.input as Record<string, unknown>;
  assert.equal(typeof input.prompt, 'string');
  assert.equal(typeof input.resolvedPromptTemplate, 'string');
  assert.match(String(input.resolvedPromptSource), /prompt_quiz_generator\.md$/);
  assert.equal(input.briefingId, 'briefing-001');
  assert.equal(input.extractionArtifactId, 'artifact-extraction-001');
  assert.deepEqual(input.stepDependencyArtifactIds, ['artifact-step-001', 'artifact-step-002']);
});
