import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor } from 'xstate';

import { toolWorkflowMachine } from '../machines/tool-workflow.machine';
import {
  computeCompetitorRanking,
  computeDomainScores,
} from '../runtime/analysis/scoring-engine';
import type { SerpSource } from '../runtime/analysis/scoring-engine';
import { scoringChainMachine } from '../machines/generation/scoring-chain.machine';

test('computeDomainScores groups by domain and weights by source type', () => {
  const sources: SerpSource[] = [
    { title: 'T1', url: 'https://healthline.com/page1', snippet: '...', sourceType: 'organic' },
    { title: 'T2', url: 'https://healthline.com/page2', snippet: '...', sourceType: 'organic' },
    { title: 'T3', url: 'https://mayoclinic.org/page1', snippet: '...', sourceType: 'sitelink' },
    { title: 'T4', url: 'https://drugs.com/page1', snippet: '...', sourceType: 'sponsored' },
  ];

  const results = computeDomainScores(sources);

  assert.equal(results.length, 3);

  const healthline = results.find((r) => r.domain === 'healthline.com');
  assert.ok(healthline);
  assert.equal(healthline?.sources, 2);
  // organic: 3.0 * 2 = 6.0 raw score
  assert.ok(healthline.geoScore >= 1 && healthline.geoScore <= 10);
  assert.ok(['TIER_1', 'TIER_2', 'TIER_3'].includes(healthline.tier));
});

test('computeDomainScores normalizes to 1-10 scale', () => {
  const sources: SerpSource[] = [
    { title: 'T1', url: 'https://a.com', snippet: '...', sourceType: 'organic' },
    { title: 'T2', url: 'https://b.com', snippet: '...', sourceType: 'sponsored' },
  ];

  const results = computeDomainScores(sources);

  for (const r of results) {
    assert.ok(r.geoScore >= 1 && r.geoScore <= 10, `geoScore ${r.geoScore} out of range`);
  }

  assert.ok(results.length >= 2);
  assert.equal((results[0]?.geoScore ?? 0) > (results[1]?.geoScore ?? 0), true, 'organic should outrank sponsored');
});

test('computeDomainScores assigns tiers correctly', () => {
  // High score domain via many organic entries
  const strongSources: SerpSource[] = Array.from({ length: 10 }, (_, i) => ({
    title: `T${i}`,
    url: `https://strong.com/page${i}`,
    snippet: '...',
    sourceType: 'organic',
  }));

  // Weak domain with only one sponsored
  const weakSources: SerpSource[] = [
    { title: 'W', url: 'https://weak.com', snippet: '...', sourceType: 'sponsored' },
  ];

  const results = computeDomainScores([...strongSources, ...weakSources]);

  const strong = results.find((r) => r.domain === 'strong.com');
  const weak = results.find((r) => r.domain === 'weak.com');

  assert.ok(strong);
  assert.ok(weak);
  assert.equal(strong.tier, 'TIER_1');
  assert.equal(weak.tier, 'TIER_3');
});

test('computeDomainScores handles empty input', () => {
  const results = computeDomainScores([]);
  assert.deepEqual(results, []);
});

test('computeDomainScores handles single domain', () => {
  const sources: SerpSource[] = [
    { title: 'T', url: 'https://only.com', snippet: '...', sourceType: 'organic' },
  ];

  const results = computeDomainScores(sources);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.domain, 'only.com');
  // Single domain gets midpoint score when range is 0
  assert.equal(results[0]?.geoScore, 5.5);
});

test('computeCompetitorRanking returns Record keyed by domain', () => {
  const sources = [
    { url: 'https://a.com/1', sourceType: 'organic' },
    { url: 'https://a.com/2', sourceType: 'organic' },
    { url: 'https://b.com/1', sourceType: 'sponsored' },
  ];

  const ranking = computeCompetitorRanking(sources, 'query-1');

  assert.ok('a.com' in ranking);
  assert.ok('b.com' in ranking);
  assert.equal(ranking['a.com'].tier, 'TIER_1');
  assert.deepEqual(ranking['a.com'].queriesCovered, ['query-1']);
});

test('computeCompetitorRanking defaults sourceType to organic', () => {
  const sources = [{ url: 'https://example.com' }];
  const ranking = computeCompetitorRanking(sources);

  assert.ok('example.com' in ranking);
  assert.equal(ranking['example.com'].geoScore, 5.5);
});

test('scoringChainMachine is pass-through with typed context', () => {
  const actor = createActor(scoringChainMachine, {
    input: {
      requestId: 'req-score-001',
      stepKey: 'score-competitors',
      sessionId: 'sess-001',
      crawlArtifacts: [],
    },
  });

  actor.start();
  const snapshot = actor.getSnapshot();

  assert.equal(snapshot.status, 'done');
  assert.equal(snapshot.context.requestId, 'req-score-001');
  assert.equal(snapshot.context.stepKey, 'score-competitors');
});

test('toolWorkflowMachine merges scoring output into assembledGenerationInput', () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-geo-score-001',
      toolKey: 'geometric',
      workflowType: 'geometric',
      runMode: 'new',
      steps: [
        { key: 'crawl-serp', dependencies: [], type: 'crawling' },
        { key: 'score-competitors', dependencies: ['crawl-serp'], type: 'scoring' },
        { key: 'generate-strategic-report', dependencies: ['score-competitors'], type: 'generation' },
      ],
      dependencyGraph: {
        'crawl-serp': [],
        'score-competitors': ['crawl-serp'],
        'generate-strategic-report': ['score-competitors'],
      },
    },
  });

  actor.start();

  // Feed crawling output first
  actor.send({ type: 'STEP_START', stepKey: 'crawl-serp' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'crawl-serp',
    output: {
      type: 'CRAWLING_COMPLETED',
      crawlArtifacts: [
        {
          query: 'protein',
          isPaa: false,
          content: 'AI overview',
          structuredPayload: {
            sources: [
              { title: 'Healthline', url: 'https://healthline.com', snippet: '...', sourceType: 'organic' },
            ],
            paaQueries: [],
          },
        },
      ],
      paaQueries: [],
    },
    artifactId: 'artifact-crawl-001',
  });

  // Feed scoring output
  actor.send({ type: 'STEP_START', stepKey: 'score-competitors' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'score-competitors',
    output: {
      type: 'SCORING_COMPLETED',
      ranking: {
        'healthline.com': { geoScore: 9.5, tier: 'TIER_1', queriesCovered: ['protein'] },
      },
    },
    artifactId: 'artifact-score-001',
  });

  const snapshot = actor.getSnapshot();
  assert.deepEqual(snapshot.context.assembledGenerationInput, {
    crawling: {
      snippets: 'AI overview',
      sources: [{ title: 'Healthline', url: 'https://healthline.com', snippet: '...', sourceType: 'organic' }],
      paaQueries: [],
    },
    scoring: {
      'healthline.com': { geoScore: 9.5, tier: 'TIER_1', queriesCovered: ['protein'] },
    },
  });
});

test('toolWorkflowMachine ignores scoring output on non-scoring steps', () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-score-ignore-001',
      toolKey: 'funnel-pages',
      workflowType: 'funnel_pages',
      runMode: 'new',
      steps: [
        { key: 'optin', dependencies: [], type: 'generation' },
      ],
      dependencyGraph: {
        optin: [],
      },
    },
  });

  actor.start();
  actor.send({ type: 'STEP_START', stepKey: 'optin' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'optin',
    output: 'optin-content',
    artifactId: 'artifact-optin-001',
  });

  const snapshot = actor.getSnapshot();
  assert.deepEqual(snapshot.context.assembledGenerationInput, {});
});
