import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleStrategicReportingInput,
  assembleUnifiedReportInput,
  selectGeometricAssembly,
} from '../machines/generation/context-generation-assembly';

test('assembleStrategicReportingInput never includes screenshot data', () => {
  const input = {
    crawling: {
      snippets: 'AI Overview snippet text',
      sources: [
        { title: 'Healthline', url: 'https://healthline.com', snippet: '...' },
      ],
      paaQueries: ['What is best?'],
      screenshotPath: '/tmp/serp-123.png',
      screenshots: ['/tmp/1.png', '/tmp/2.png'],
    },
    scoring: {
      'healthline.com': { geoScore: 9.5, tier: 'TIER_1' },
    },
    screenshotData: 'base64image',
  };

  const result = assembleStrategicReportingInput(input);

  assert.equal('screenshotPath' in result, false, 'screenshotPath must be stripped');
  assert.equal('screenshots' in result, false, 'screenshots must be stripped');
  assert.equal('screenshotData' in result, false, 'screenshotData must be stripped');
  assert.deepEqual(result.serpSnippets, ['AI Overview snippet text']);
  assert.deepEqual(result.paaQueries, ['What is best?']);
  const competitor = (result.competitorRanking as Record<string, Record<string, unknown>>)['healthline.com'];
  assert.equal(competitor?.geoScore, 9.5);
});

test('assembleUnifiedReportInput never includes screenshot data', () => {
  const input = {
    crawling: {
      snippets: 'Snippet text',
      screenshotPath: '/tmp/serp-456.png',
    },
    scoring: {
      'example.com': { geoScore: 5.5, tier: 'TIER_2' },
    },
  };

  const result = assembleUnifiedReportInput(input);

  assert.equal('screenshotPath' in result, false, 'screenshotPath must be stripped');
  assert.equal('crawling' in result, false, 'crawling key must be stripped');
  assert.equal('screenshotData' in result, false, 'screenshotData must be stripped');
  const competitor = (result.competitorRanking as Record<string, Record<string, unknown>>)['example.com'];
  assert.equal(competitor?.geoScore, 5.5);
});

test('selectGeometricAssembly returns null for non-reporting steps', () => {
  assert.equal(selectGeometricAssembly('serp-crawling', {}), null);
  assert.equal(selectGeometricAssembly('competitor-scoring', {}), null);
});

test('selectGeometricAssembly returns strategic reporting input for strategic-reporting', () => {
  const result = selectGeometricAssembly('strategic-reporting', {
    crawling: { snippets: 'test', paaQueries: [] },
  });

  assert.notEqual(result, null);
  assert.deepEqual(result?.serpSnippets, ['test']);
});

test('selectGeometricAssembly returns unified report input for unified-report', () => {
  const result = selectGeometricAssembly('unified-report', {
    scoring: { 'a.com': { geoScore: 8 } },
  });

  assert.notEqual(result, null);
  const competitor = (result?.competitorRanking as Record<string, Record<string, unknown>>)['a.com'];
  assert.equal(competitor?.geoScore, 8);
});

test('assembleStrategicReportingInput handles empty input gracefully', () => {
  const result = assembleStrategicReportingInput({});

  assert.deepEqual(result.serpSnippets, []);
  assert.deepEqual(result.paaQueries, []);
  assert.deepEqual(result.competitorRanking, {});
});

test('assembleUnifiedReportInput handles empty input gracefully', () => {
  const result = assembleUnifiedReportInput({});

  assert.deepEqual(result.competitorRanking, {});
});
