import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveToolPrompt } from '../runtime/tool-prompts';

test('resolveToolPrompt loads brief-generator extraction prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'extraction',
    artifactType: 'extraction',
    extractionToolKey: 'brief-generator',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_extraction\.md$/);
  assert.match(resolved.prompt, /Extraction Fields/i);
  assert.match(resolved.prompt, /product_or_service/i);
});

test('resolveToolPrompt loads brief-generator generation prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'brief-generator',
    workflowType: 'brief_generator',
    artifactType: 'content',
    stepKey: 'brief-generation',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_brief_generation\.md$/);
  assert.match(resolved.prompt, /BRIEF GENERATION/i);
  assert.match(resolved.prompt, /Italian only/i);
});

test('resolveToolPrompt returns null for unknown brief-generator step', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'brief-generator',
    workflowType: 'brief_generator',
    artifactType: 'content',
    stepKey: 'unknown-step',
  });

  assert.equal(resolved, null);
});

test('resolveToolPrompt extraction prompt contains all 5 extraction fields', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'extraction',
    artifactType: 'extraction',
    extractionToolKey: 'brief-generator',
  });

  assert.ok(resolved);
  assert.match(resolved.prompt, /product_or_service/);
  assert.match(resolved.prompt, /target_audience/);
  assert.match(resolved.prompt, /campaign_objective/);
  assert.match(resolved.prompt, /primary_offer/);
  assert.match(resolved.prompt, /tone/);
});
