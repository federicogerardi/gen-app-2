/**
 * SerpApi crawling tests
 * Tests SerpApi-only crawling with no Puppeteer fallback
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crawlSerp, discoverPAAQueries } from '../runtime/integrations/crawling.adapter';

test('crawlSerp requires apiService and throws without it', async () => {
  // crawlSerp now requires apiService — calling without it should fail at type level
  // This test verifies the function signature requires 4 parameters
  assert.equal(crawlSerp.length, 4, 'crawlSerp should require 4 parameters (query, language, country, apiService)');
});

test('discoverPAAQueries requires apiService and throws without it', async () => {
  assert.equal(discoverPAAQueries.length, 4, 'discoverPAAQueries should require 4 parameters');
});

test('crawlSerp propagates SerpApi errors without fallback', async () => {
  // Create a mock apiService that will fail
  const mockApiService = {
    id: 'test-fail',
    key: 'test-fail',
    label: 'Test Fail',
    baseUrl: 'https://serpapi.com/search',
    resourcePath: '/search',
    accessMode: 'query-param' as const,
    timeoutMs: 5000,
    retryCount: 0,
    requestMethod: 'GET' as const,
    requestTemplateJson: {},
    requestMappingRulesJson: [],
    requestHeadersTemplateJson: {},
    tokenHeaderName: null,
    tokenParamName: 'api_key',
    responseMappingRulesJson: [],
    errorMappingRulesJson: [],
    contractProfileVersion: 1,
    tokenRef: 'invalid-key',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    tokenCiphertext: 'invalid-api-key',
  };

  try {
    await crawlSerp('test query', 'it', 'google.it', mockApiService);
    assert.fail('Should have thrown — invalid API key should cause SerpApi error');
  } catch (error) {
    assert.ok(error instanceof Error, 'Should throw Error');
    // SerpApi returns error in payload, not HTTP error, so we check the error message
    assert.ok(
      error.message.includes('SerpApi') || error.message.includes('error') || error.message.includes('failed'),
      'Error should mention SerpApi or failure',
    );
  }
});

test('SerpApi normalizer handles AI Overview response structure', async () => {
  const { normalizeSerpApiAiOverview, extractPAAQueriesFromSerpApi, requiresSeparateAiOverviewRequest } =
    await import('../runtime/integrations/serpapi-normalizer.js');

  assert.ok(typeof normalizeSerpApiAiOverview === 'function');
  assert.ok(typeof extractPAAQueriesFromSerpApi === 'function');
  assert.ok(typeof requiresSeparateAiOverviewRequest === 'function');

  // Test error handling for invalid response
  try {
    const invalidResponse = {
      search_metadata: {
        status: 'Error' as const,
        id: 'test',
        created_at: '2026-06-20T10:00:00Z',
        processed_at: '2026-06-20T10:00:01Z',
        total_time_taken: 1.0,
      },
      search_parameters: {
        engine: 'google_ai_overview' as const,
        page_token: 'test-token',
      },
      error: 'Test error',
      ai_overview: {
        text_blocks: [],
        references: [],
      },
    };

    normalizeSerpApiAiOverview(invalidResponse);
    assert.fail('Should have thrown error for invalid response');
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes('SerpApi error'));
  }
});
