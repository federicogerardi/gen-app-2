import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor } from 'xstate';

import { toolWorkflowMachine } from '../machines/tool-workflow.machine';
import { resolveToolPrompt } from '../runtime/tool-prompts';
import {
  selectGeometricAssembly,
} from '../machines/generation/context-generation-assembly';

test('geometric tool end-to-end: 4-step workflow completes with correct data flow', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-geo-e2e-001',
      toolKey: 'geometric',
      workflowType: 'geometric',
      runMode: 'new',
      steps: [
        { key: 'crawl-serp', dependencies: [], type: 'crawling' },
        { key: 'score-competitors', dependencies: ['crawl-serp'], type: 'scoring' },
        { key: 'generate-strategic-report', dependencies: ['score-competitors'], type: 'generation' },
        { key: 'generate-unified-report', dependencies: ['generate-strategic-report'], type: 'generation' },
      ],
      dependencyGraph: {
        'crawl-serp': [],
        'score-competitors': ['crawl-serp'],
        'generate-strategic-report': ['score-competitors'],
        'generate-unified-report': ['generate-strategic-report'],
      },
    },
  });

  actor.start();

  // Step 1: Crawling (mock browser data)
  actor.send({ type: 'STEP_START', stepKey: 'crawl-serp' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'crawl-serp',
    output: {
      type: 'CRAWLING_COMPLETED',
      crawlArtifacts: [
        {
          query: 'protein supplements',
          isPaa: false,
          content: 'AI overview: protein supplements help muscle growth',
          structuredPayload: {
            sources: [
              { title: 'Healthline', url: 'https://healthline.com', snippet: 'Best protein powders 2026' },
              { title: 'MyProtein', url: 'https://myprotein.com', snippet: 'Whey vs casein comparison' },
            ],
            paaQueries: ['What is the best protein powder?', 'Is whey protein safe?'],
          },
        },
        {
          query: 'What is the best protein powder?',
          isPaa: true,
          content: 'PAA result: best protein powder depends on goals',
          structuredPayload: {
            sources: [
              { title: 'Bodybuilding.com', url: 'https://bodybuilding.com', snippet: 'Top 10 protein supplements' },
            ],
            paaQueries: [],
          },
        },
      ],
      paaQueries: ['What is the best protein powder?', 'Is whey protein safe?'],
    },
    artifactId: 'artifact-crawl-e2e-001',
  });

  const afterCrawl = actor.getSnapshot();
  assert.deepEqual(afterCrawl.context.assembledGenerationInput, {
    crawling: {
      snippets: 'AI overview: protein supplements help muscle growth\n\nPAA result: best protein powder depends on goals',
      sources: [
        { title: 'Healthline', url: 'https://healthline.com', snippet: 'Best protein powders 2026' },
        { title: 'MyProtein', url: 'https://myprotein.com', snippet: 'Whey vs casein comparison' },
        { title: 'Bodybuilding.com', url: 'https://bodybuilding.com', snippet: 'Top 10 protein supplements' },
      ],
      paaQueries: ['What is the best protein powder?', 'Is whey protein safe?'],
    },
  });

  // Step 2: Scoring (mock LLM analysis)
  actor.send({ type: 'STEP_START', stepKey: 'score-competitors' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'score-competitors',
    output: {
      type: 'SCORING_COMPLETED',
      ranking: {
        'healthline.com': { geoScore: 92, tier: 'S' },
        'myprotein.com': { geoScore: 78, tier: 'A' },
        'bodybuilding.com': { geoScore: 65, tier: 'B' },
      },
    },
    artifactId: 'artifact-score-e2e-001',
  });

  const afterScore = actor.getSnapshot();
  assert.deepEqual(afterScore.context.assembledGenerationInput, {
    crawling: {
      snippets: 'AI overview: protein supplements help muscle growth\n\nPAA result: best protein powder depends on goals',
      sources: [
        { title: 'Healthline', url: 'https://healthline.com', snippet: 'Best protein powders 2026' },
        { title: 'MyProtein', url: 'https://myprotein.com', snippet: 'Whey vs casein comparison' },
        { title: 'Bodybuilding.com', url: 'https://bodybuilding.com', snippet: 'Top 10 protein supplements' },
      ],
      paaQueries: ['What is the best protein powder?', 'Is whey protein safe?'],
    },
    scoring: {
      'healthline.com': { geoScore: 92, tier: 'S' },
      'myprotein.com': { geoScore: 78, tier: 'A' },
      'bodybuilding.com': { geoScore: 65, tier: 'B' },
    },
  });

  // Step 3: Strategic Reporting (mock LLM generation)
  actor.send({ type: 'STEP_START', stepKey: 'generate-strategic-report' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'generate-strategic-report',
    output: 'Strategic report: focus on healthline content gap',
    artifactId: 'artifact-strategic-e2e-001',
  });

  const afterStrategic = actor.getSnapshot();
  assert.equal(afterStrategic.status, 'active');

  // Step 4: Unified Report (mock LLM generation)
  actor.send({ type: 'STEP_START', stepKey: 'generate-unified-report' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'generate-unified-report',
    output: 'Unified report: comprehensive competitor analysis',
    artifactId: 'artifact-unified-e2e-001',
  });

  const final = actor.getSnapshot();
  assert.equal(final.status, 'done');
});

test('geometric prompt resolver resolves strategic-reporting and unified-report prompts', async () => {
  const strategicPrompt = resolveToolPrompt({
    toolKey: 'geometric',
    stepKey: 'strategic-reporting',
  });
  assert.ok(strategicPrompt);
  assert.ok(strategicPrompt.filePath.includes('prompt_strategic_reporting.md'));
  assert.ok(strategicPrompt.prompt.length > 0);

  const unifiedPrompt = resolveToolPrompt({
    toolKey: 'geometric',
    stepKey: 'unified-report',
  });
  assert.ok(unifiedPrompt);
  assert.ok(unifiedPrompt.filePath.includes('prompt_unified_report.md'));
  assert.ok(unifiedPrompt.prompt.length > 0);
});

test('geometric context assembly excludes non-canonical fields from LLM context', async () => {
  const assembledInput = {
    crawling: {
      snippets: 'AI overview about protein',
      sources: [
        { title: 'Healthline', url: 'https://healthline.com', snippet: 'Best protein', extraData: 'should-not-appear' },
      ],
      paaQueries: ['What is protein?'],
    },
    scoring: {
      'healthline.com': { geoScore: 92, tier: 'S' },
    },
  };

  const assembly = selectGeometricAssembly('strategic-reporting', assembledInput);

  // Verify assembly was created
  assert.ok(assembly);

  // Verify non-canonical data is NOT in the assembled output
  const assemblyStr = JSON.stringify(assembly);
  assert.equal(assemblyStr.includes('should-not-appear'), false);

  // Verify serp snippets and paaQueries ARE present
  assert.equal(assemblyStr.includes('AI overview about protein'), true);
  assert.equal(assemblyStr.includes('What is protein?'), true);
  assert.equal(assemblyStr.includes('competitorRanking'), true);
});

test('geometric context assembly produces correct strategic-reporting input', async () => {
  const assembled = {
    crawling: {
      snippets: 'AI overview snippet',
      sources: [
        { title: 'Healthline', url: 'https://healthline.com', snippet: 'Best protein powders' },
      ],
      paaQueries: ['What is the best protein?'],
    },
    scoring: {
      'healthline.com': { geoScore: 92, tier: 'S' },
    },
  };

  const assembly = selectGeometricAssembly('strategic-reporting', assembled);
  assert.ok(assembly);
  assert.deepEqual(assembly, {
    serpSnippets: ['AI overview snippet'],
    paaQueries: ['What is the best protein?'],
    competitorRanking: {
      'healthline.com': { geoScore: 92, tier: 'S' },
    },
    currentDate: new Date().toLocaleDateString('it-IT'),
  });
});

test('geometric context assembly produces correct unified-report input', async () => {
  const assembled = {
    crawling: {
      snippets: 'AI overview snippet',
      sources: [
        { title: 'Healthline', url: 'https://healthline.com', snippet: 'Best protein powders' },
      ],
      paaQueries: ['What is the best protein?'],
    },
    scoring: {
      'healthline.com': { geoScore: 92, tier: 'S' },
    },
  };

  const assembly = selectGeometricAssembly('unified-report', assembled);
  assert.ok(assembly);
  assert.deepEqual(assembly, {
    serpSnippets: ['AI overview snippet'],
    paaQueries: ['What is the best protein?'],
    baseQuery: '',
    queryCount: 2,
    competitorRanking: {
      'healthline.com': { geoScore: 92, tier: 'S' },
    },
    currentDate: new Date().toLocaleDateString('it-IT'),
  });
});
