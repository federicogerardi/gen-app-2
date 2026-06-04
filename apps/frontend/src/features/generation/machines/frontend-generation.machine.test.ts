import { createActor, fromPromise } from 'xstate';
import { describe, expect, it, vi } from 'vitest';
import { frontendGenerationMachine } from './frontend-generation.machine';
import type { GenerationRequest } from '../contracts/backend-stream';
import type { GenerationRunResponse } from '@gen-app-2/contracts';
import { TEST_API_BASE_URL } from '../../../test/fixtures';

const createRequest = (requestId: string): GenerationRequest => ({
  requestId,
  userId: 'user-1',
  projectId: 'project-1',
  artifactType: 'content' as const,
  model: 'openrouter/auto',
  input: { prompt: 'test' },
  registrySnapshotRef: 'snapshot:default',
});

const createTestActor = () => {
  const machine = frontendGenerationMachine.provide({
    actors: {
      runGenerationActor: fromPromise<GenerationRunResponse, { request: GenerationRequest; apiBaseUrl: string }>(async () => ({
        artifactId: 'art-1',
        content: 'Generated content',
        status: 'completed' as const,
        metrics: { inputTokens: 10, outputTokens: 20, costUsd: 0.0001 },
      })),
    },
  });

  const actor = createActor(machine, {
    input: { apiBaseUrl: TEST_API_BASE_URL },
  });

  actor.start();
  return actor;
};

describe('frontendGenerationMachine', () => {
  it('transitions idle -> running -> completed on success', async () => {
    const actor = createTestActor();

    expect(actor.getSnapshot().matches('idle')).toBe(true);

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-1'),
    });

    expect(actor.getSnapshot().matches('running')).toBe(true);
    expect(actor.getSnapshot().context.lastRequest).toEqual(createRequest('req-1'));

    const snapshot = await vi.waitUntil(() => {
      const s = actor.getSnapshot();
      return s.matches('completed') ? s : undefined;
    }, { timeout: 1000 });

    expect(snapshot).toBeDefined();
    expect(snapshot.context.artifactId).toBe('art-1');
    expect(snapshot.context.content).toBe('Generated content');
    expect(snapshot.context.errorCode).toBeNull();
    expect(snapshot.context.errorMessage).toBeNull();
  });

  it('transitions idle -> running -> failed on actor error', async () => {
    const machine = frontendGenerationMachine.provide({
      actors: {
        runGenerationActor: fromPromise<GenerationRunResponse, { request: GenerationRequest; apiBaseUrl: string }>(async () => {
          throw new Error('Network failure');
        }),
      },
    });

    const actor = createActor(machine, {
      input: { apiBaseUrl: TEST_API_BASE_URL },
    });

    actor.start();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-fail-1'),
    });

    expect(actor.getSnapshot().matches('running')).toBe(true);

    const snapshot = await vi.waitUntil(() => {
      const s = actor.getSnapshot();
      return s.matches('failed') ? s : undefined;
    }, { timeout: 1000 });

    expect(snapshot).toBeDefined();
    expect(snapshot.context.errorCode).toBe('generation_failed');
    expect(snapshot.context.errorMessage).toBe('Network failure');
    expect(snapshot.context.artifactId).toBeNull();
  });

  it('resets to idle from completed', async () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-reset-1'),
    });

    await vi.waitUntil(() => actor.getSnapshot().matches('completed'), { timeout: 1000 });

    actor.send({ type: 'RESET' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('idle')).toBe(true);
    expect(snapshot.context.artifactId).toBeNull();
    expect(snapshot.context.content).toBe('');
    expect(snapshot.context.lastRequest).toBeNull();
  });

  it('resets to idle from failed', async () => {
    const machine = frontendGenerationMachine.provide({
      actors: {
        runGenerationActor: fromPromise<GenerationRunResponse, { request: GenerationRequest; apiBaseUrl: string }>(async () => {
          throw new Error('Forced error');
        }),
      },
    });

    const actor = createActor(machine, {
      input: { apiBaseUrl: TEST_API_BASE_URL },
    });

    actor.start();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-reset-fail-1'),
    });

    await vi.waitUntil(() => actor.getSnapshot().matches('failed'), { timeout: 1000 });

    actor.send({ type: 'RESET' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('idle')).toBe(true);
    expect(snapshot.context.errorCode).toBeNull();
    expect(snapshot.context.errorMessage).toBeNull();
  });

  it('caches request metadata on REQUEST_START', () => {
    const actor = createTestActor();
    const request = createRequest('req-meta-1');

    actor.send({ type: 'REQUEST_START', request });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.requestId).toBe('req-meta-1');
    expect(snapshot.context.lastRequest).toEqual(request);
  });

  it('handles CHECKPOINT_UPSERTED in all states', async () => {
    const actor = createTestActor();

    actor.send({
      type: 'CHECKPOINT_UPSERTED',
      checkpoint: {
        artifactId: 'cp-1',
        projectId: 'project-1',
        status: 'completed',
        extractionContextAvailable: true,
        model: 'openrouter/auto',
        workflowType: null,
        toolKey: null,
        contentPreview: '',
        updatedAt: new Date().toISOString(),
      },
    });

    expect(actor.getSnapshot().context.checkpoints).toHaveLength(1);

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-cp-1'),
    });

    actor.send({
      type: 'CHECKPOINT_UPSERTED',
      checkpoint: {
        artifactId: 'cp-2',
        projectId: 'project-1',
        status: 'completed',
        extractionContextAvailable: true,
        model: 'openrouter/auto',
        workflowType: null,
        toolKey: null,
        contentPreview: '',
        updatedAt: new Date().toISOString(),
      },
    });

    await vi.waitUntil(() => actor.getSnapshot().matches('completed'), { timeout: 1000 });

    expect(actor.getSnapshot().context.checkpoints).toHaveLength(2);
  });
});
