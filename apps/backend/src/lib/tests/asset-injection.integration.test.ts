import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInMemoryGenerationAdapters } from '../adapters/generation';
import { runBackendGenerationSessionAsJson } from '../runtime/backend-session';
import type { AssetSnapshotResolver, ResolvedAssetContent } from '../runtime/asset-injection-resolver';

test('generation with assetReferences injects asset content into prompt', async () => {
  const adapters = createInMemoryGenerationAdapters();

  const snapshotContent: ResolvedAssetContent = {
    assetId: 'asset-angle-001',
    assetType: 'angle',
    label: 'Primary Angle',
    content: '{"title": "AI Automation for SMBs", "key_benefit": "Save 10 hours/week"}',
    versionNumber: 1,
    staleUpstream: false,
  };

  const mockResolver: AssetSnapshotResolver = {
    getAssetSnapshot: async (assetId: string) => {
      if (assetId === 'asset-angle-001') return snapshotContent;
      return null;
    },
    getGroupAssetSnapshots: async () => [],
  };

  adapters.assetSnapshotResolver = mockResolver;

  let capturedPrompt = '';
  const originalGenerateText = adapters.generate.generateText;
  adapters.generate.generateText = async (input) => {
    capturedPrompt = typeof input.requestInput.prompt === 'string' ? input.requestInput.prompt : '';
    return originalGenerateText(input);
  };

  const result = await runBackendGenerationSessionAsJson(
    {
      requestId: 'req-asset-inject-001',
      userId: 'user-asset-001',
      projectId: 'project-asset-001',
      artifactType: 'content',
      model: 'openrouter/auto',
      input: {
        prompt: 'Generate content about this topic.',
        step: 'context-and-angle-matrix',
        toolKey: 'angle-generator',
        assetReferences: [
          { assetId: 'asset-angle-001', sourceToolKey: 'angle-generator', usageIntent: 'injection' },
        ],
      },
      toolKey: 'angle-generator',
      workflowType: null,
      idempotencyKey: 'idem-asset-inject-001',
      registrySnapshotRef: 'snapshot:asset-inject',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.ok(result.content.length > 0);
  assert.ok(capturedPrompt.includes('AI Automation for SMBs'), 'asset title should be in prompt');
  assert.ok(capturedPrompt.includes('Save 10 hours/week'), 'asset key_benefit should be in prompt');
  assert.ok(capturedPrompt.includes('Generate content about this topic.'), 'original prompt should remain');
});

test('generation with empty assetReferences does not modify prompt', async () => {
  const adapters = createInMemoryGenerationAdapters();

  let capturedPrompt = '';
  const originalGenerateText = adapters.generate.generateText;
  adapters.generate.generateText = async (input) => {
    capturedPrompt = typeof input.requestInput.prompt === 'string' ? input.requestInput.prompt : '';
    return originalGenerateText(input);
  };

  const result = await runBackendGenerationSessionAsJson(
    {
      requestId: 'req-asset-empty-001',
      userId: 'user-asset-001',
      projectId: 'project-asset-001',
      artifactType: 'content',
      model: 'openrouter/auto',
      input: {
        prompt: 'Original prompt only.',
        step: 'context-and-angle-matrix',
      },
      toolKey: 'angle-generator',
      workflowType: null,
      idempotencyKey: 'idem-asset-empty-001',
      registrySnapshotRef: 'snapshot:asset-empty',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.equal(capturedPrompt, 'Original prompt only.');
});

test('generation with unresolvable assetId still completes', async () => {
  const adapters = createInMemoryGenerationAdapters();

  adapters.assetSnapshotResolver = {
    getAssetSnapshot: async () => null,
    getGroupAssetSnapshots: async () => [],
  };

  let capturedPrompt = '';
  const originalGenerateText = adapters.generate.generateText;
  adapters.generate.generateText = async (input) => {
    capturedPrompt = typeof input.requestInput.prompt === 'string' ? input.requestInput.prompt : '';
    return originalGenerateText(input);
  };

  const result = await runBackendGenerationSessionAsJson(
    {
      requestId: 'req-asset-missing-001',
      userId: 'user-asset-001',
      projectId: 'project-asset-001',
      artifactType: 'content',
      model: 'openrouter/auto',
      input: {
        prompt: 'Fallback prompt.',
        step: 'context-and-angle-matrix',
        assetReferences: [
          { assetId: 'nonexistent-asset', sourceToolKey: 'angle-generator', usageIntent: 'injection' },
        ],
      },
      toolKey: 'angle-generator',
      workflowType: null,
      idempotencyKey: 'idem-asset-missing-001',
      registrySnapshotRef: 'snapshot:asset-missing',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.equal(capturedPrompt, 'Fallback prompt.');
});
