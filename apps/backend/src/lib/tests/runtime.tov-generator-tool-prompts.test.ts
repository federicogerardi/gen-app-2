import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveToolPrompt } from '../runtime/tool-prompts';

test('resolveToolPrompt loads tov-generator extraction prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'extraction',
    artifactType: 'extraction',
    extractionToolKey: 'tov-generator',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_extraction\.md$/);
  assert.match(resolved.prompt, /Extraction Fields/i);
  assert.match(resolved.prompt, /brand_or_company/i);
});

test('resolveToolPrompt loads tov-generator generation prompt', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'tov-generator',
    workflowType: 'tov_generator',
    artifactType: 'content',
    stepKey: 'tov-generation',
  });

  assert.ok(resolved);
  assert.match(resolved.filePath, /prompt_tov_generation\.md$/);
  assert.match(resolved.prompt, /TOV GENERATION/i);
  assert.match(resolved.prompt, /Italian only/i);
});

test('resolveToolPrompt returns null for unknown tov-generator step', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'tov-generator',
    workflowType: 'tov_generator',
    artifactType: 'content',
    stepKey: 'unknown-step',
  });

  assert.equal(resolved, null);
});

test('resolveToolPrompt extraction prompt contains all 5 extraction fields', () => {
  const resolved = resolveToolPrompt({
    toolKey: 'extraction',
    artifactType: 'extraction',
    extractionToolKey: 'tov-generator',
  });

  assert.ok(resolved);
  assert.match(resolved.prompt, /brand_or_company/);
  assert.match(resolved.prompt, /target_audience/);
  assert.match(resolved.prompt, /tone/);
  assert.match(resolved.prompt, /product_or_service/);
  assert.match(resolved.prompt, /market/);
});
