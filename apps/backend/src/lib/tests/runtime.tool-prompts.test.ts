import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRequestReceivedEvent } from '../runtime/request-contract';
import { resolveToolPrompt } from '../runtime/tool-prompts';

test('resolveToolPrompt loads funnel optin prompt from markdown files', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'funnel-pages',
    workflowType: 'funnel_pages',
    artifactType: 'content',
    stepKey: 'optin',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /src\/lib\/runtime\/tool-prompts\/hl_funnel\/prompt_optin_generator\.md$/);
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
    workflowType: 'funnel_pages',
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

test('buildRequestReceivedEvent normalizes legacy colon model ids for OpenRouter', () => {
  const event = buildRequestReceivedEvent({
    requestId: 'req-model-normalization-001',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    artifactType: 'content',
    model: 'openrouter:auto',
    input: {
      prompt: 'normalize me',
    },
    toolKey: null,
    workflowType: null,
    registrySnapshotRef: 'snapshot:model-normalization',
  });

  assert.equal(event.model, 'openrouter/auto');
});

test('resolveToolPrompt loads youtube-lf-script step prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'youtube-lf-script',
    workflowType: 'youtube_lf_script',
    artifactType: 'content',
    stepKey: 'pre-script-analysis',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_pre_script_analysis\.md$/);
  assert.match(resolved.prompt, /Step Key/i);
});

test('resolveToolPrompt loads nextland step prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'nextland',
    workflowType: 'nextland',
    artifactType: 'content',
    stepKey: 'thank-you',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_thank_you_generator\.md$/);
  assert.match(resolved.prompt, /PROMPT NEXTLAND THANK-YOU GENERATOR/i);
});

test('buildRequestReceivedEvent resolves youtube extraction prompt from extraction target tool key', () => {
  const event = buildRequestReceivedEvent({
    requestId: 'req-youtube-extraction-001',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    artifactType: 'extraction',
    model: 'openrouter/auto',
    toolKey: 'extraction',
    workflowType: 'extraction',
    input: {
      toolKey: 'youtube-lf-script',
      briefingText: 'Brief testo',
    },
    registrySnapshotRef: 'snapshot:youtube-extraction',
  });

  const input = event.input as Record<string, unknown>;
  assert.match(String(input.resolvedPromptSource), /prompt_extraction\.md$/);
  assert.equal(input.tone, 'analitico');
});

test('buildRequestReceivedEvent canonicalizes generation tone profile and step key aliases', () => {
  const event = buildRequestReceivedEvent({
    requestId: 'req-generation-normalization-001',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    artifactType: 'content',
    model: 'openrouter/auto',
    toolKey: 'nextland',
    workflowType: 'nextland',
    input: {
      step: 'thank-you',
      tone: 'formal',
    },
    registrySnapshotRef: 'snapshot:generation-normalization',
  });

  const input = event.input as Record<string, unknown>;
  assert.equal(input.step, 'thank_you');
  assert.equal(input.tone, 'Formal');
});

test('buildRequestReceivedEvent drops invalid step and non-canonical generation tone', () => {
  const event = buildRequestReceivedEvent({
    requestId: 'req-generation-normalization-002',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    artifactType: 'content',
    model: 'openrouter/auto',
    toolKey: 'funnel-pages',
    workflowType: 'funnel_pages',
    input: {
      step: 'landing',
      tone: 'direct',
    },
    registrySnapshotRef: 'snapshot:generation-normalization',
  });

  const input = event.input as Record<string, unknown>;
  assert.equal(Object.hasOwn(input, 'step'), false);
  assert.equal(Object.hasOwn(input, 'tone'), false);
});

test('resolveToolPrompt falls back to canonical extraction prompt for non-youtube extraction', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'extraction',
    workflowType: 'extraction',
    artifactType: 'extraction',
    extractionToolKey: 'funnel-pages',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /runtime\/tool-prompts\/extraction\/prompt_generation\.md$/);
});
