import test from 'node:test';
import assert from 'node:assert/strict';

import { computeAiOverviewConfidence } from '../runtime/integrations/crawling.adapter';
import type { CrawlingResult } from '../runtime/integrations/crawling.adapter';

test('computeAiOverviewConfidence maps selectors to correct confidence values', () => {
  assert.equal(computeAiOverviewConfidence('[data-snf]'), 0.95);
  assert.equal(computeAiOverviewConfidence('.AIHVYe'), 0.90);
  assert.equal(computeAiOverviewConfidence('[data-attrid="wa:/description"]'), 0.85);
  assert.equal(computeAiOverviewConfidence(''), 0.50);
  assert.equal(computeAiOverviewConfidence('unknown'), 0.50);
  assert.equal(computeAiOverviewConfidence('.random-selector'), 0.50);
});

test('CrawlingResult type accepts aiOverviewConfidence and selectorUsed fields', () => {
  const result: CrawlingResult = {
    aiOverviewSnippet: 'AI overview text',
    aiOverviewConfidence: 0.95,
    selectorUsed: '[data-snf]',
    sources: [
      {
        title: 'Healthline',
        url: 'https://healthline.com',
        snippet: 'Best protein powders',
        sourceType: 'organic',
      },
    ],
    screenshotPath: '/tmp/serp-123.png',
    adsCount: 0,
    videoCount: 0,
  };

  assert.equal(result.aiOverviewConfidence, 0.95);
  assert.equal(result.selectorUsed, '[data-snf]');
  assert.equal(result.aiOverviewSnippet, 'AI overview text');
  assert.equal(result.sources.length, 1);
  assert.equal(result.adsCount, 0);
  assert.equal(result.videoCount, 0);
});

test('CrawlingResult type accepts fallback confidence values', () => {
  const result: CrawlingResult = {
    aiOverviewSnippet: null,
    aiOverviewConfidence: 0.50,
    selectorUsed: '',
    sources: [],
    screenshotPath: null,
    adsCount: 0,
    videoCount: 0,
  };

  assert.equal(result.aiOverviewConfidence, 0.50);
  assert.equal(result.selectorUsed, '');
  assert.equal(result.aiOverviewSnippet, null);
});
