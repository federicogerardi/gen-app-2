import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StreamDoneOutputSchema,
  GenerateDoneOutputSchema,
  IdempotencyDoneOutputSchema,
  UsageDoneOutputSchema,
  OwnershipDoneOutputSchema,
  ExtractionDoneOutputSchema,
  ToolDoneOutputSchema,
  AcquisitionDoneOutputSchema,
  CrawlingDoneOutputSchema,
  ScoringDoneOutputSchema,
} from '../machines/generation-system.event-schemas';
import {
  getStreamDoneOutput,
  getGenerateDoneOutput,
  getIdempotencyDoneOutput,
  getUsageDoneOutput,
  getOwnershipDoneOutput,
  getExtractionDoneOutput,
  getToolDoneOutput,
  getAcquisitionDoneOutput,
  getCrawlingDoneOutput,
  getScoringDoneOutput,
} from '../machines/generation-system.events';

test('StreamDoneOutputSchema accepts valid success output', () => {
  const result = StreamDoneOutputSchema.safeParse({
    type: 'STREAM_TERMINATED_SUCCESS',
    content: 'hello',
    metrics: { inputTokens: 10, outputTokens: 20, costUsd: 0.01 },
  });
  assert.ok(result.success);
});

test('StreamDoneOutputSchema accepts valid failure output', () => {
  const result = StreamDoneOutputSchema.safeParse({
    type: 'STREAM_TERMINATED_FAILURE',
    reason: 'timeout',
  });
  assert.ok(result.success);
});

test('StreamDoneOutputSchema rejects invalid type', () => {
  const result = StreamDoneOutputSchema.safeParse({ type: 'INVALID' });
  assert.equal(result.success, false);
});

test('GenerateDoneOutputSchema accepts valid output', () => {
  const result = GenerateDoneOutputSchema.safeParse({
    type: 'GENERATE_TERMINATED_SUCCESS',
    content: 'text',
  });
  assert.ok(result.success);
});

test('IdempotencyDoneOutputSchema accepts all variants', () => {
  assert.ok(IdempotencyDoneOutputSchema.safeParse({ type: 'IDEMPOTENCY_CLAIMED' }).success);
  assert.ok(IdempotencyDoneOutputSchema.safeParse({
    type: 'IDEMPOTENCY_REPLAY_READY',
    artifactId: 'art-1',
    metadata: { content: 'cached' },
  }).success);
  assert.ok(IdempotencyDoneOutputSchema.safeParse({
    type: 'IDEMPOTENCY_CONFLICT',
    reason: 'duplicate',
  }).success);
});

test('UsageDoneOutputSchema accepts granted and rejected', () => {
  assert.ok(UsageDoneOutputSchema.safeParse({ type: 'USAGE_GRANTED', creditCost: 5 }).success);
  assert.ok(UsageDoneOutputSchema.safeParse({ type: 'USAGE_REJECTED', reason: 'quota' }).success);
});

test('OwnershipDoneOutputSchema accepts ok and rejected', () => {
  assert.ok(OwnershipDoneOutputSchema.safeParse({ type: 'OWNERSHIP_OK' }).success);
  assert.ok(OwnershipDoneOutputSchema.safeParse({ type: 'OWNERSHIP_REJECTED', reason: 'denied' }).success);
});

test('ExtractionDoneOutputSchema accepts all variants', () => {
  assert.ok(ExtractionDoneOutputSchema.safeParse({
    type: 'EXTRACTION_ATTEMPT_ACCEPTED',
    artifactId: 'art-1',
    content: 'data',
    structuredPayload: { fields: {} },
  }).success);
  assert.ok(ExtractionDoneOutputSchema.safeParse({
    type: 'EXTRACTION_ATTEMPT_REJECTED',
    reason: 'invalid',
  }).success);
  assert.ok(ExtractionDoneOutputSchema.safeParse({
    type: 'EXTRACTION_CHAIN_EXHAUSTED',
    reason: 'retries',
  }).success);
});

test('ToolDoneOutputSchema accepts unlocked and completed', () => {
  assert.ok(ToolDoneOutputSchema.safeParse({ type: 'WORKFLOW_STEP_UNLOCKED' }).success);
  assert.ok(ToolDoneOutputSchema.safeParse({
    type: 'WORKFLOW_STEP_COMPLETED',
    artifactId: 'art-1',
  }).success);
});

test('AcquisitionDoneOutputSchema accepts accepted and skipped', () => {
  assert.ok(AcquisitionDoneOutputSchema.safeParse({
    type: 'ACQUISITION_ATTEMPT_ACCEPTED',
    statusCode: 200,
    payload: { data: 'ok' },
  }).success);
  assert.ok(AcquisitionDoneOutputSchema.safeParse({
    type: 'ACQUISITION_ATTEMPT_SKIPPED',
    reason: 'no config',
  }).success);
});

test('CrawlingDoneOutputSchema accepts completed with artifacts', () => {
  const result = CrawlingDoneOutputSchema.safeParse({
    type: 'CRAWLING_COMPLETED',
    crawlArtifacts: [{ query: 'test', isPaa: false, content: 'html', structuredPayload: {} }],
    paaQueries: ['what is it'],
  });
  assert.ok(result.success);
});

test('ScoringDoneOutputSchema accepts completed with ranking', () => {
  assert.ok(ScoringDoneOutputSchema.safeParse({
    type: 'SCORING_COMPLETED',
    ranking: { 'example.com': { score: 8 } },
  }).success);
});

test('getStreamDoneOutput returns valid output', () => {
  const output = getStreamDoneOutput({
    output: { type: 'STREAM_TERMINATED_SUCCESS', content: 'hi' },
  });
  assert.ok(output);
  assert.equal(output.type, 'STREAM_TERMINATED_SUCCESS');
});

test('getStreamDoneOutput returns undefined for malformed output', () => {
  const output = getStreamDoneOutput({ output: { type: 'INVALID' } });
  assert.equal(output, undefined);
});

test('getStreamDoneOutput returns undefined for missing output', () => {
  assert.equal(getStreamDoneOutput({}), undefined);
  assert.equal(getStreamDoneOutput({ output: undefined }), undefined);
});

test('getUsageDoneOutput returns valid output', () => {
  const output = getUsageDoneOutput({
    output: { type: 'USAGE_GRANTED', creditCost: 5 },
  });
  assert.ok(output);
  assert.equal(output.type, 'USAGE_GRANTED');
});

test('getUsageDoneOutput returns undefined for invalid type', () => {
  const output = getUsageDoneOutput({ output: { type: 'BAD' } });
  assert.equal(output, undefined);
});

test('getToolDoneOutput returns valid output', () => {
  const output = getToolDoneOutput({
    output: { type: 'WORKFLOW_STEP_COMPLETED', artifactId: 'art-1' },
  });
  assert.ok(output);
  assert.equal(output.type, 'WORKFLOW_STEP_COMPLETED');
  assert.equal(output.artifactId, 'art-1');
});

test('getToolDoneOutput returns undefined for malformed output', () => {
  const output = getToolDoneOutput({ output: { type: 'WORKFLOW_STEP_COMPLETED' } });
  assert.equal(output, undefined);
});
