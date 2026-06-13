import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor } from 'xstate';

import { toolWorkflowMachine } from '../machines/tool-workflow.machine';

test('toolWorkflowMachine merges crawling output into assembledGenerationInput', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-geo-001',
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
          content: 'AI overview snippet about protein',
          structuredPayload: {
            sources: [
              { title: 'Healthline', url: 'https://healthline.com', snippet: 'Best protein powders' },
            ],
            paaQueries: ['What protein is best for muscle?', 'Is protein safe daily?'],
          },
        },
      ],
      paaQueries: ['What protein is best for muscle?', 'Is protein safe daily?'],
    },
    artifactId: 'artifact-crawl-001',
  });

  const snapshotAfterCrawling = actor.getSnapshot();
  assert.deepEqual(snapshotAfterCrawling.context.assembledGenerationInput, {
    crawling: {
      snippets: 'AI overview snippet about protein',
      sources: [{ title: 'Healthline', url: 'https://healthline.com', snippet: 'Best protein powders' }],
      paaQueries: ['What protein is best for muscle?', 'Is protein safe daily?'],
    },
  });

  actor.send({ type: 'STEP_START', stepKey: 'score-competitors' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'score-competitors',
    output: {
      type: 'SCORING_COMPLETED',
      ranking: {
        'competitor-a.com': { geoScore: 87, tier: 'S' },
        'competitor-b.com': { geoScore: 52, tier: 'B' },
      },
    },
    artifactId: 'artifact-score-001',
  });

  const snapshotAfterScoring = actor.getSnapshot();
  assert.deepEqual(snapshotAfterScoring.context.assembledGenerationInput, {
    crawling: {
      snippets: 'AI overview snippet about protein',
      sources: [{ title: 'Healthline', url: 'https://healthline.com', snippet: 'Best protein powders' }],
      paaQueries: ['What protein is best for muscle?', 'Is protein safe daily?'],
    },
    scoring: {
      'competitor-a.com': { geoScore: 87, tier: 'S' },
      'competitor-b.com': { geoScore: 52, tier: 'B' },
    },
  });

  actor.send({ type: 'STEP_START', stepKey: 'generate-strategic-report' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'generate-strategic-report',
    output: 'Strategic report content here',
    artifactId: 'artifact-report-001',
  });

  const finalSnapshot = actor.getSnapshot();
  assert.equal(finalSnapshot.status, 'done');
});

test('toolWorkflowMachine ignores crawling output on non-crawling steps', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-geo-002',
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
    artifactId: 'artifact-optin-002',
  });

  const snapshot = actor.getSnapshot();
  assert.deepEqual(snapshot.context.assembledGenerationInput, {});
});

test('toolWorkflowMachine handles empty crawling output gracefully', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-geo-003',
      toolKey: 'geometric',
      workflowType: 'geometric',
      runMode: 'new',
      steps: [
        { key: 'crawl-serp', dependencies: [], type: 'crawling' },
        { key: 'generate-strategic-report', dependencies: ['crawl-serp'], type: 'generation' },
      ],
      dependencyGraph: {
        'crawl-serp': [],
        'generate-strategic-report': ['crawl-serp'],
      },
    },
  });

  actor.start();
  actor.send({ type: 'STEP_START', stepKey: 'crawl-serp' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'crawl-serp',
    output: {
      type: 'CRAWLING_COMPLETED',
      crawlArtifacts: [],
      paaQueries: [],
    },
    artifactId: 'artifact-crawl-003',
  });

  const snapshot = actor.getSnapshot();
  assert.deepEqual(snapshot.context.assembledGenerationInput, {});
});
