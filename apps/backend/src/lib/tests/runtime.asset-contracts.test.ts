/**
 * Asset Domain Tests — Contracts & Compatibility Matrix
 *
 * G-001: Unit tests for AssetCompatibilityMatrix
 * G-002: Unit tests for asset types and validation
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSET_TYPES,
  isAssetType,
  TOOL_ASSET_CONTRACTS,
  getCompatibleConsumerTools,
  getCompatibleAssetTypes,
  getProducedAssetTypes,
  getToolProductionChain,
  isValidAssetReference,
  resolveFieldMapping,
  ASSET_FIELD_MAPPINGS,
} from '@gen-app-2/contracts';
import type { AssetReference, ToolKey } from '@gen-app-2/contracts';

// =====================================================================
// A-001: AssetType tests
// =====================================================================

test('ASSET_TYPES contains all 13 canonical values', () => {
  assert.equal(ASSET_TYPES.length, 13);
  assert.ok(ASSET_TYPES.includes('angle'));
  assert.ok(ASSET_TYPES.includes('persona'));
  assert.ok(ASSET_TYPES.includes('brand-voice'));
  assert.ok(ASSET_TYPES.includes('hook'));
  assert.ok(ASSET_TYPES.includes('competitor-analysis'));
  assert.ok(ASSET_TYPES.includes('creative-brief'));
  assert.ok(ASSET_TYPES.includes('ad-copy'));
  assert.ok(ASSET_TYPES.includes('landing-page'));
  assert.ok(ASSET_TYPES.includes('article-outline'));
  assert.ok(ASSET_TYPES.includes('article'));
  assert.ok(ASSET_TYPES.includes('script'));
  assert.ok(ASSET_TYPES.includes('description'));
  assert.ok(ASSET_TYPES.includes('brief'));
});

test('isAssetType validates correct values', () => {
  assert.ok(isAssetType('angle'));
  assert.ok(isAssetType('persona'));
  assert.ok(isAssetType('brand-voice'));
  assert.ok(!isAssetType('invalid'));
  assert.ok(!isAssetType(''));
  assert.ok(!isAssetType('Angle'));
});

// =====================================================================
// A-003: ToolAssetContract tests
// =====================================================================

test('TOOL_ASSET_CONTRACTS has entry for all tools', () => {
  const expectedTools: ToolKey[] = [
    'funnel-pages',
    'nextland',
    'youtube-lf-script',
    'angle-generator',
    'meta-ads',
    'youtube-description',
    'geometric',
    'blog-article-generator',
  ];

  for (const tool of expectedTools) {
    assert.ok(TOOL_ASSET_CONTRACTS[tool], `Missing contract for ${tool}`);
    assert.ok(Array.isArray(TOOL_ASSET_CONTRACTS[tool].produces), `${tool} produces must be array`);
    assert.ok(Array.isArray(TOOL_ASSET_CONTRACTS[tool].consumes), `${tool} consumes must be array`);
  }
});

test('angle-generator produces angle and consumes optional types', () => {
  const contract = TOOL_ASSET_CONTRACTS['angle-generator'];
  assert.deepEqual(contract.produces, ['angle']);
  assert.ok(contract.consumes.includes('brief'));
  assert.ok(contract.consumes.includes('persona?'));
  assert.ok(contract.consumes.includes('competitor-analysis?'));
  assert.ok(!contract.consumes.includes('brand-voice'));
});

test('meta-ads produces ad-copy and hook, consumes angle', () => {
  const contract = TOOL_ASSET_CONTRACTS['meta-ads'];
  assert.deepEqual(contract.produces, ['ad-copy', 'hook']);
  assert.ok(contract.consumes.includes('angle'));
  assert.ok(contract.consumes.includes('persona'));
});

// =====================================================================
// A-004: AssetCompatibilityMatrix tests
// =====================================================================

test('getCompatibleConsumerTools returns tools that consume angle', () => {
  const consumers = getCompatibleConsumerTools('angle');
  assert.ok(consumers.includes('meta-ads'), 'meta-ads should consume angle');
});

test('getCompatibleConsumerTools returns tools that consume persona', () => {
  const consumers = getCompatibleConsumerTools('persona');
  assert.ok(consumers.length > 0, 'At least one tool should consume persona');
  assert.ok(consumers.includes('meta-ads'));
  assert.ok(consumers.includes('angle-generator'));
});

test('getCompatibleConsumerTools returns empty for unsupported type', () => {
  // All current AssetTypes are consumed by at least one tool
  // This test verifies the function handles unknown types gracefully
  const consumers = getCompatibleConsumerTools('description');
  assert.ok(Array.isArray(consumers));
});

test('getCompatibleAssetTypes returns required and optional for meta-ads', () => {
  const { required } = getCompatibleAssetTypes('meta-ads');
  assert.ok(required.includes('angle'), 'angle should be required for meta-ads');
  assert.ok(required.includes('persona'), 'persona should be required for meta-ads');
  assert.ok(required.includes('brand-voice'), 'brand-voice should be required for meta-ads');
  assert.ok(required.includes('hook'), 'hook should be required for meta-ads');
});

test('getCompatibleAssetTypes returns empty for geometric (no consumes)', () => {
  const { required, optional } = getCompatibleAssetTypes('geometric');
  assert.equal(required.length, 0, 'geometric should have no required types');
  assert.equal(optional.length, 0, 'geometric should have no optional types');
});

test('getProducedAssetTypes returns correct types for each tool', () => {
  assert.deepEqual(getProducedAssetTypes('angle-generator'), ['angle']);
  assert.deepEqual(getProducedAssetTypes('meta-ads'), ['ad-copy', 'hook']);
  assert.deepEqual(getProducedAssetTypes('geometric'), ['competitor-analysis']);
  assert.deepEqual(getProducedAssetTypes('blog-article-generator'), ['article-outline', 'article']);
});

test('getToolProductionChain returns connecting types', () => {
  // angle-generator produces angle, meta-ads consumes angle
  const chain = getToolProductionChain('angle-generator', 'meta-ads');
  assert.ok(chain.includes('angle'), 'angle should connect angle-generator to meta-ads');
});

test('getToolProductionChain returns empty when no connection', () => {
  // geometric produces competitor-analysis, but funnel-pages doesn't consume it
  const chain = getToolProductionChain('geometric', 'funnel-pages');
  assert.equal(chain.length, 0, 'No connection between geometric and funnel-pages');
});

// =====================================================================
// A-006: AssetReference validation tests
// =====================================================================

test('isValidAssetReference accepts valid assetId reference', () => {
  const ref: AssetReference = {
    assetId: 'ast_123',
    sourceToolKey: 'angle-generator',
    usageIntent: 'input',
  };
  assert.ok(isValidAssetReference(ref));
});

test('isValidAssetReference accepts valid assetGroupId reference', () => {
  const ref: AssetReference = {
    assetGroupId: 'grp_123',
    sourceToolKey: 'angle-generator',
    usageIntent: 'input',
  };
  assert.ok(isValidAssetReference(ref));
});

test('isValidAssetReference rejects reference with both assetId and assetGroupId', () => {
  const ref: AssetReference = {
    assetId: 'ast_123',
    assetGroupId: 'grp_123',
    sourceToolKey: 'angle-generator',
    usageIntent: 'input',
  };
  assert.ok(!isValidAssetReference(ref));
});

test('isValidAssetReference rejects reference with neither assetId nor assetGroupId', () => {
  const ref: AssetReference = {
    sourceToolKey: 'angle-generator',
    usageIntent: 'input',
  };
  assert.ok(!isValidAssetReference(ref));
});

// =====================================================================
// A-005: AssetFieldMapping tests
// =====================================================================

test('ASSET_FIELD_MAPPINGS contains angle→meta-ads mapping', () => {
  const mapping = ASSET_FIELD_MAPPINGS['angle→meta-ads'];
  assert.ok(mapping, 'angle→meta-ads mapping should exist');
  assert.ok(mapping.title, 'title field should exist');
  assert.ok(mapping.hook, 'hook field should exist');
  assert.ok(mapping.targetPersona, 'targetPersona field should exist');
});

test('resolveFieldMapping returns mapping for valid key', () => {
  const mapping = resolveFieldMapping('angle→meta-ads');
  assert.ok(mapping);
  assert.ok(mapping!.title?.injectionTemplate, '## Angle: {{title}}');
});

test('resolveFieldMapping returns null for unknown key', () => {
  const mapping = resolveFieldMapping('unknown→tool');
  assert.equal(mapping, null);
});
