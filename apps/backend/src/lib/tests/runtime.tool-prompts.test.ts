import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRequestReceivedEvent, type BackendGenerationRequest } from '../runtime/request-contract';
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
    model: 'openrouter/gpt-5.3-codex',
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
    model: 'openrouter/auto',
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

test('resolveToolPrompt loads angle-generator context-and-angle-matrix prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'angle-generator',
    workflowType: 'angle_generator',
    artifactType: 'content',
    stepKey: 'context-and-angle-matrix',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_context_and_angle_matrix\.md$/);
  assert.match(resolved.prompt, /CONTEXT AND ANGLE MATRIX/i);
});

test('resolveToolPrompt loads meta-ads context-generation prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'meta-ads',
    workflowType: 'meta_ads_generator',
    artifactType: 'content',
    stepKey: 'context-generation',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /meta-ads\/prompt_context_generation\.md$/);
  assert.match(resolved.prompt, /CONTEXT GENERATION/i);
});

test('resolveToolPrompt composes youtube-description context and generation prompts', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'youtube-description',
    workflowType: 'youtube_description',
    artifactType: 'content',
    stepKey: 'youtube-description-generation',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /youtube-description\/prompt_youtube_description_generation\.md$/);
  assert.match(resolved.prompt, /PROMPT YOUTUBE DESCRIPTION - CONTEXT GENERATION/i);
  assert.match(resolved.prompt, /PROMPT YOUTUBE DESCRIPTION - GENERATION/i);
  assert.match(resolved.prompt, /ORCHESTRATION CONTRACT/i);
});

test('resolveToolPrompt enforces meta-ads ads-generation completeness contract', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'meta-ads',
    workflowType: 'meta_ads_generator',
    artifactType: 'content',
    stepKey: 'ads-generation',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /meta-ads\/prompt_ads_generation\.md$/);
  assert.match(resolved.prompt, /Italian only \(`it-IT`\)/i);
  assert.match(resolved.prompt, /CLUSTER 1/i);
  assert.match(resolved.prompt, /Angolo 1/i);
  assert.match(resolved.prompt, /Versione Problem Aware/i);
  assert.match(resolved.prompt, /Versione Solution Aware/i);
  assert.match(resolved.prompt, /Versione Product Aware/i);
  assert.match(resolved.prompt, /copy_length_format/i);
  assert.match(resolved.prompt, /SHORT FORM/i);
  assert.match(resolved.prompt, /MEDIUM FORM/i);
  assert.match(resolved.prompt, /LONG FORM/i);
  assert.match(resolved.prompt, /Headline/i);
  assert.match(resolved.prompt, /Description/i);
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
});

test('buildRequestReceivedEvent resolves angle-generator extraction prompt from extraction target tool key', () => {
  const event = buildRequestReceivedEvent({
    requestId: 'req-angle-extraction-001',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    artifactType: 'extraction',
    model: 'openrouter/auto',
    toolKey: 'extraction',
    workflowType: 'extraction',
    input: {
      toolKey: 'angle-generator',
      briefingText: 'Brief testo',
    },
    registrySnapshotRef: 'snapshot:angle-extraction',
  } as unknown as BackendGenerationRequest);

  const input = event.input as Record<string, unknown>;
  assert.match(String(input.resolvedPromptSource), /prompt_extraction\.md$/);
  assert.match(String(input.resolvedPromptSource), /angle-generator/);
});

test('buildRequestReceivedEvent resolves meta-ads extraction prompt from extraction target tool key', () => {
  const event = buildRequestReceivedEvent({
    requestId: 'req-meta-ads-extraction-001',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    artifactType: 'extraction',
    model: 'openrouter/auto',
    toolKey: 'extraction',
    workflowType: 'extraction',
    input: {
      toolKey: 'meta-ads',
      briefingText: 'Brief text',
    },
    registrySnapshotRef: 'snapshot:meta-ads-extraction',
  } as unknown as BackendGenerationRequest);

  const input = event.input as Record<string, unknown>;
  assert.match(String(input.resolvedPromptSource), /prompt_extraction\.md$/);
  assert.match(String(input.resolvedPromptSource), /meta-ads/);
});

test('buildRequestReceivedEvent canonicalizes generation step key aliases', () => {
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
    },
    registrySnapshotRef: 'snapshot:generation-normalization',
  } as unknown as BackendGenerationRequest);

  const input = event.input as Record<string, unknown>;
  assert.equal(input.step, 'thank_you');
});

test('buildRequestReceivedEvent drops invalid step key', () => {
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
    },
    registrySnapshotRef: 'snapshot:generation-normalization',
  } as unknown as BackendGenerationRequest);

  const input = event.input as Record<string, unknown>;
  assert.equal(Object.hasOwn(input, 'step'), false);
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
