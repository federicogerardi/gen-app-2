import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters/generation';
import { generationSystemMachine } from '../machines';
import type { GenerationMachineContext } from '../machines/generation-system.types';
import {
  selectDomainContext,
  selectRuntimeContext,
  selectMetricsContext,
  selectInfraContext,
  selectErrorContext,
  selectDecomposedContext,
} from '../machines/generation-system.context-accessors';
import { buildGenerationCoreDefaults, buildGenerationRuntimeDefaults, buildGenerationMetricsDefaults, buildGenerationInfraContext } from '../machines/generation-system.runtime';

const createMockContext = (): GenerationMachineContext => {
  const adapters = createInMemoryGenerationAdapters();
  return {
    ...buildGenerationCoreDefaults(),
    ...buildGenerationRuntimeDefaults(),
    ...buildGenerationMetricsDefaults(),
    ...buildGenerationInfraContext(adapters),
    requestId: 'req-001',
    userId: 'user-001',
    projectId: 'proj-001',
    sessionId: 'sess-001',
    toolKey: 'blog-article-generator',
    workflowType: 'blog_article_generator',
    artifactType: 'content',
    model: 'gpt-4',
    requestInput: { prompt: 'test prompt', step: 'draft' },
    idempotencyKey: 'idem-001',
    outputFormat: 'markdown',
    routeType: 'tool',
    mode: 'stream',
    inputTokens: 150,
    outputTokens: 300,
    costUsd: 0.0045,
    _creditCost: 2,
    contentBuffer: 'test content',
    artifactId: 'art-001',
    failureReason: null,
    syntheticResponse: '',
    pendingFallback: null,
    effectiveModelResolution: null,
  };
};

test('accessor composition preserves all fields', () => {
  const ctx = createMockContext();
  const recomposed = selectDecomposedContext(ctx);

  const originalKeys = Object.keys(ctx).sort();
  const recomposedKeys = Object.keys(recomposed).sort();

  assert.deepEqual(recomposedKeys, originalKeys, 'recomposed context keys must match original');

  for (const key of originalKeys) {
    const k = key as keyof GenerationMachineContext;
    assert.deepEqual(
      recomposed[k],
      ctx[k],
      `field "${k}" must be preserved after recomposition`,
    );
  }
});

test('field boundary enforcement per sub-context', () => {
  const ctx = createMockContext();

  const domain = selectDomainContext(ctx);
  assert.equal(domain.requestId, 'req-001');
  assert.equal(domain.toolKey, 'blog-article-generator');
  assert.equal('model' in domain, false, 'selectDomainContext must NOT have model (Runtime)');
  assert.equal('requestInput' in domain, false, 'selectDomainContext must NOT have requestInput (Runtime)');

  const runtime = selectRuntimeContext(ctx);
  assert.equal(runtime.model, 'gpt-4');
  assert.equal(runtime.routeType, 'tool');
  assert.equal('requestId' in runtime, false, 'selectRuntimeContext must NOT have requestId (Domain)');
  assert.equal('artifactId' in runtime, false, 'selectRuntimeContext must NOT have artifactId (Domain)');

  const metrics = selectMetricsContext(ctx);
  assert.equal(metrics.inputTokens, 150);
  assert.equal(metrics.costUsd, 0.0045);
  assert.equal('toolKey' in metrics, false, 'selectMetricsContext must NOT have toolKey (Domain)');
  assert.equal('requestInput' in metrics, false, 'selectMetricsContext must NOT have requestInput (Runtime)');

  const infra = selectInfraContext(ctx);
  assert.ok(infra.adapters, 'infra must have adapters');
  assert.ok(typeof infra.runtimeNow === 'function', 'infra must have runtimeNow');
  assert.equal('requestId' in infra, false, 'selectInfraContext must NOT have requestId (Domain)');

  const error = selectErrorContext(ctx);
  assert.equal(error.pendingFallback, null);
  assert.equal('requestId' in error, false, 'selectErrorContext must NOT have requestId (Domain)');
  assert.equal('model' in error, false, 'selectErrorContext must NOT have model (Runtime)');
});

test('legacy action pattern compatibility', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(generationSystemMachine, {
    input: { adapters },
  });
  actor.start();

  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-legacy',
    projectId: 'proj-legacy',
    sessionId: 'sess-legacy',
    toolKey: 'blog-article-generator',
    artifactType: 'content',
    workflowType: 'blog_article_generator',
    model: 'gpt-4',
    input: { prompt: 'test' },
    idempotencyKey: null,
    outputFormat: 'plain',
    registryVersion: 'v1',
    registrySnapshotRef: 'snap-001',
    syntheticResponse: '',
    effectiveModelResolution: null,
  } as never);

  const snapshot = actor.getSnapshot();
  const ctx = snapshot.context;

  assert.equal(ctx.requestId, 'req-legacy', 'legacy assignGeneration must still update requestId');
  assert.equal(ctx.projectId, 'proj-legacy', 'legacy assignGeneration must still update projectId');
  assert.equal(ctx.model, 'gpt-4', 'legacy assignGeneration must still update model');

  const domain = selectDomainContext(ctx);
  assert.equal(domain.requestId, 'req-legacy', 'accessors must reflect legacy action updates');

  actor.stop();
});

test('cacheRequestMeta composed action parity', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(generationSystemMachine, {
    input: { adapters },
  });
  actor.start();

  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-composed',
    projectId: 'proj-composed',
    sessionId: 'sess-composed',
    toolKey: 'blog-article-generator',
    artifactType: 'content',
    workflowType: 'blog_article_generator',
    model: 'gpt-4',
    input: { prompt: 'composed test', step: 'draft' },
    idempotencyKey: 'idem-composed',
    outputFormat: 'markdown',
    registryVersion: 'v1',
    registrySnapshotRef: 'snap-002',
    syntheticResponse: '',
    effectiveModelResolution: null,
  } as never);

  const ctx = actor.getSnapshot().context;

  const domain = selectDomainContext(ctx);
  assert.equal(domain.requestId, 'req-composed', 'cacheDomainMeta must set requestId');
  assert.equal(domain.projectId, 'proj-composed', 'cacheDomainMeta must set projectId');
  assert.equal(domain.sessionId, 'sess-composed', 'cacheDomainMeta must set sessionId');
  assert.equal(domain.toolKey, 'blog-article-generator', 'cacheDomainMeta must set toolKey');
  assert.equal(domain.failureReason, null, 'cacheDomainMeta must clear failureReason');
  assert.equal(domain.contentBuffer, '', 'cacheDomainMeta must clear contentBuffer');
  assert.equal(domain.artifactId, null, 'cacheDomainMeta must clear artifactId');

  const runtime = selectRuntimeContext(ctx);
  assert.equal(runtime.model, 'gpt-4', 'cacheRuntimeMeta must set model');
  assert.deepEqual(runtime.requestInput, { prompt: 'composed test', step: 'draft' }, 'cacheRuntimeMeta must set requestInput');
  assert.equal(runtime.idempotencyKey, 'idem-composed', 'cacheRuntimeMeta must set idempotencyKey');
  assert.equal(runtime.outputFormat, 'plain', 'cacheRuntimeMeta must set outputFormat (normalized from event.input)');
  assert.equal(runtime.routeType, 'tool', 'cacheRuntimeMeta must set routeType');

  const metrics = selectMetricsContext(ctx);
  assert.equal(metrics.inputTokens, 0, 'resetMetricsMeta must reset inputTokens');
  assert.equal(metrics.outputTokens, 0, 'resetMetricsMeta must reset outputTokens');
  assert.equal(metrics.costUsd, 0, 'resetMetricsMeta must reset costUsd');

  const error = selectErrorContext(ctx);
  assert.equal(error.pendingFallback, null, 'resetErrorMeta must clear pendingFallback');

  actor.stop();
});

test('accessor stability across non-touched concerns', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(generationSystemMachine, {
    input: { adapters },
  });
  actor.start();

  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-stability',
    projectId: 'proj-stability',
    sessionId: 'sess-stability',
    toolKey: 'blog-article-generator',
    artifactType: 'content',
    workflowType: 'blog_article_generator',
    model: 'gpt-4',
    input: { prompt: 'stability test' },
    idempotencyKey: null,
    outputFormat: 'plain',
    registryVersion: null,
    registrySnapshotRef: null,
    syntheticResponse: '',
    effectiveModelResolution: null,
  } as never);

  const ctx = actor.getSnapshot().context;
  const infra = selectInfraContext(ctx);

  assert.ok(infra.adapters, 'adapters must be present after cacheRequestMeta');
  assert.ok(typeof infra.runtimeNow === 'function', 'runtimeNow must be a function after cacheRequestMeta');
  assert.ok(typeof infra.artifactIdFactory === 'function', 'artifactIdFactory must be a function after cacheRequestMeta');
  assert.ok(typeof infra.responseBuilder === 'function', 'responseBuilder must be a function after cacheRequestMeta');

  assert.equal(infra.adapters, adapters, 'adapters reference must be stable (not replaced by cacheRequestMeta)');

  actor.stop();
});
