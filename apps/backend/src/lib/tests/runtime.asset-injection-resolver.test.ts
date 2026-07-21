/**
 * Asset Injection Resolver Tests
 *
 * G-002: Unit tests for asset injection resolver
 * Tests: resolveAssetContent, resolveAssetInjectedPrompt, checkAssetStaleness
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateAssetReferences,
  resolveAssetContent,
  resolveAssetInjectedPrompt,
  checkAssetStaleness,
  createAssetInjectionLogger,
  type ResolvedAssetContent,
  type InjectionDirectiveInput,
} from '../runtime/asset-injection-resolver';

// =====================================================================
// D-001: validateAssetReferences tests
// =====================================================================

test('validateAssetReferences accepts valid references', () => {
  const refs = [
    { assetId: 'ast_1', sourceToolKey: 'angle-generator', usageIntent: 'input' as const },
    { assetGroupId: 'grp_1', sourceToolKey: 'meta-ads', usageIntent: 'injection' as const },
  ];
  const result = validateAssetReferences(refs);
  assert.ok(result.valid);
  assert.equal(result.errors.length, 0);
});

test('validateAssetReferences rejects reference with both assetId and assetGroupId', () => {
  const refs = [
    {
      assetId: 'ast_1',
      assetGroupId: 'grp_1',
      sourceToolKey: 'angle-generator',
      usageIntent: 'input' as const,
    },
  ];
  const result = validateAssetReferences(refs);
  assert.ok(!result.valid);
  assert.ok(result.errors.length > 0);
});

test('validateAssetReferences rejects reference with neither assetId nor assetGroupId', () => {
  const refs = [
    { sourceToolKey: 'angle-generator', usageIntent: 'input' as const },
  ];
  const result = validateAssetReferences(refs);
  assert.ok(!result.valid);
  assert.ok(result.errors.length > 0);
});

// =====================================================================
// D-002: resolveAssetContent tests
// =====================================================================

test('resolveAssetContent returns raw content when no field mapping', () => {
  const asset: ResolvedAssetContent = {
    assetId: 'ast_1',
    assetType: 'angle',
    label: 'Test Angle',
    content: 'Raw content here',
    versionNumber: 1,
    staleUpstream: false,
  };

  const result = resolveAssetContent(asset);
  assert.equal(result, 'Raw content here');
});

test('resolveAssetContent applies field mapping templates', () => {
  const asset: ResolvedAssetContent = {
    assetId: 'ast_1',
    assetType: 'angle',
    label: 'Summer Campaign',
    content: JSON.stringify({
      title: 'Summer Sale',
      hook: '50% off everything',
      targetPersona: 'Young adults 18-25',
    }),
    versionNumber: 1,
    staleUpstream: false,
  };

  const result = resolveAssetContent(asset, 'angle→meta-ads');
  assert.ok(result.includes('## Angle: Summer Sale'));
  assert.ok(result.includes('### Primary Hook: 50% off everything'));
  assert.ok(result.includes('### Target Audience: Young adults 18-25'));
});

test('resolveAssetContent falls back to raw content for unknown mapping', () => {
  const asset: ResolvedAssetContent = {
    assetId: 'ast_1',
    assetType: 'angle',
    label: 'Test',
    content: 'Raw content',
    versionNumber: 1,
    staleUpstream: false,
  };

  const result = resolveAssetContent(asset, 'unknown→mapping');
  assert.equal(result, 'Raw content');
});

// =====================================================================
// D-003: resolveAssetInjectedPrompt tests
// =====================================================================

test('resolveAssetInjectedPrompt returns base prompt when no directives', () => {
  const basePrompt = 'You are a helpful assistant.';
  const assets: ResolvedAssetContent[] = [];
  const directives: InjectionDirectiveInput[] = [];

  const result = resolveAssetInjectedPrompt(basePrompt, assets, directives, 'step1');
  assert.equal(result, basePrompt);
});

test('resolveAssetInjectedPrompt prepends asset content', () => {
  const basePrompt = 'Generate ad copy.';
  const assets: ResolvedAssetContent[] = [
    {
      assetId: 'ast_1',
      assetType: 'angle',
      label: 'Test Angle',
      content: 'Angle content here',
      versionNumber: 1,
      staleUpstream: false,
    },
  ];
  const directives: InjectionDirectiveInput[] = [
    { assetId: 'ast_1', stepKey: 'ads-generation', injectionMode: 'prepend' },
  ];

  const result = resolveAssetInjectedPrompt(basePrompt, assets, directives, 'ads-generation');
  assert.ok(result.startsWith('Angle content here'));
  assert.ok(result.includes('Generate ad copy.'));
});

test('resolveAssetInjectedPrompt appends asset content', () => {
  const basePrompt = 'Generate ad copy.';
  const assets: ResolvedAssetContent[] = [
    {
      assetId: 'ast_1',
      assetType: 'angle',
      label: 'Test Angle',
      content: 'Angle content here',
      versionNumber: 1,
      staleUpstream: false,
    },
  ];
  const directives: InjectionDirectiveInput[] = [
    { assetId: 'ast_1', stepKey: 'ads-generation', injectionMode: 'append' },
  ];

  const result = resolveAssetInjectedPrompt(basePrompt, assets, directives, 'ads-generation');
  assert.ok(result.includes('Generate ad copy.'));
  assert.ok(result.endsWith('Angle content here'));
});

test('resolveAssetInjectedPrompt replaces base prompt', () => {
  const basePrompt = 'Generate ad copy.';
  const assets: ResolvedAssetContent[] = [
    {
      assetId: 'ast_1',
      assetType: 'angle',
      label: 'Test Angle',
      content: 'Replacement content',
      versionNumber: 1,
      staleUpstream: false,
    },
  ];
  const directives: InjectionDirectiveInput[] = [
    { assetId: 'ast_1', stepKey: 'ads-generation', injectionMode: 'replace' },
  ];

  const result = resolveAssetInjectedPrompt(basePrompt, assets, directives, 'ads-generation');
  assert.equal(result, 'Replacement content');
});

test('resolveAssetInjectedPrompt filters directives by step key', () => {
  const basePrompt = 'Generate ad copy.';
  const assets: ResolvedAssetContent[] = [
    {
      assetId: 'ast_1',
      assetType: 'angle',
      label: 'Test Angle',
      content: 'Angle content',
      versionNumber: 1,
      staleUpstream: false,
    },
  ];
  const directives: InjectionDirectiveInput[] = [
    { assetId: 'ast_1', stepKey: 'other-step', injectionMode: 'prepend' },
  ];

  const result = resolveAssetInjectedPrompt(basePrompt, assets, directives, 'ads-generation');
  assert.equal(result, basePrompt);
});

// =====================================================================
// D-005: checkAssetStaleness tests
// =====================================================================

test('checkAssetStaleness returns not stale for fresh asset', () => {
  const asset: ResolvedAssetContent = {
    assetId: 'ast_1',
    assetType: 'angle',
    label: 'Test',
    content: 'Content',
    versionNumber: 1,
    staleUpstream: false,
  };

  const result = checkAssetStaleness(asset);
  assert.equal(result.isStale, false);
});

test('checkAssetStaleness returns stale for asset with staleUpstream', () => {
  const asset: ResolvedAssetContent = {
    assetId: 'ast_1',
    assetType: 'angle',
    label: 'Test',
    content: 'Content',
    versionNumber: 1,
    staleUpstream: true,
  };

  const upstream: ResolvedAssetContent[] = [
    {
      assetId: 'upstream_1',
      assetType: 'angle',
      label: 'Original Angle',
      content: 'Original',
      versionNumber: 2,
      staleUpstream: false,
    },
  ];

  const result = checkAssetStaleness(asset, upstream);
  assert.equal(result.isStale, true);
  assert.equal(result.upstreamLabel, 'Original Angle');
  assert.ok(result.warningMessage?.includes('Original Angle'));
});

// =====================================================================
// D-005: createAssetInjectionLogger tests
// =====================================================================

test('createAssetInjectionLogger creates logger with all methods', () => {
  const logger = createAssetInjectionLogger();
  assert.equal(typeof logger.logInjectionResolved, 'function');
  assert.equal(typeof logger.logStalenessWarning, 'function');
  assert.equal(typeof logger.logInjectionError, 'function');
});

test('createAssetInjectionLogger uses custom logger when provided', () => {
  const logs: string[] = [];
  const customLogger = {
    warn: (msg: string) => logs.push(`WARN: ${msg}`),
    info: (msg: string) => logs.push(`INFO: ${msg}`),
    error: (msg: string) => logs.push(`ERROR: ${msg}`),
  };

  const logger = createAssetInjectionLogger(customLogger);
  logger.logInjectionResolved({
    assetId: 'ast_1',
    assetType: 'angle',
    contentLength: 100,
  });

  assert.equal(logs.length, 1);
  assert.ok(logs[0]?.includes('INFO:'));
  assert.ok(logs[0]?.includes('ast_1'));
});
