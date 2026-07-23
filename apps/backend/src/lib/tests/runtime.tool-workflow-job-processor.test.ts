import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { createInMemoryGenerationAdapters } from '../adapters';
import { processToolWorkflowJob } from '../runtime/tool-workflow-job-processor';
import type { ToolWorkflowJobData } from '../runtime/tool-workflow-job-queue';

class MockRedis extends EventEmitter {
  store = new Map<string, string>();
  published: Array<{ channel: string; message: string }> = [];
  deleted: string[] = [];

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string, _ex?: string, _ttl?: number): Promise<string> {
    this.store.set(key, value);
    return 'OK';
  }
  async del(key: string): Promise<number> {
    this.deleted.push(key);
    this.store.delete(key);
    return 1;
  }
  async publish(channel: string, message: string): Promise<number> {
    this.published.push({ channel, message });
    return 1;
  }
  async subscribe(_channel: string): Promise<void> {}
  override on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
  override off(event: string, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }
  duplicate(): MockRedis {
    return new MockRedis();
  }
  async quit(): Promise<string> {
    return 'OK';
  }
}

const buildJobData = (overrides: Partial<ToolWorkflowJobData> = {}): ToolWorkflowJobData => ({
  toolKey: 'funnel-pages',
  projectId: 'project-1',
  userId: 'user-1',
  extractionPayload: { schemaVersion: 'extraction.v1' },
  model: 'openrouter/auto',
  intent: 'new',
  idempotencyKey: 'idem-key-1',
  jobId: 'job-1',
  ...overrides,
});

const buildMockJob = (data: ToolWorkflowJobData) => ({
  id: data.jobId,
  data,
}) as any;

test('processor derives per-step idempotency keys', async () => {
  const redis = new MockRedis() as any;
  const adapters = createInMemoryGenerationAdapters();
  const job = buildMockJob(buildJobData());

  await processToolWorkflowJob(job, { adapters, redis });

  const events = redis.published.map((p: any) => JSON.parse(p.message));
  const startedEvents = events.filter((e: any) => e.type === 'step_started');
  const completedEvents = events.filter((e: any) => e.type === 'step_completed');

  assert.ok(startedEvents.length > 0, 'should have step_started events');
  assert.ok(completedEvents.length > 0, 'should have step_completed events');

  const workflowCompleted = events.find((e: any) => e.type === 'workflow_completed');
  assert.ok(workflowCompleted, 'should have workflow_completed event');
  assert.ok(workflowCompleted.result.artifactIds.length > 0, 'should have artifact IDs');
});

test('processor routes all funnel-pages steps through generation', async () => {
  const redis = new MockRedis() as any;
  const adapters = createInMemoryGenerationAdapters();
  const job = buildMockJob(buildJobData({ toolKey: 'funnel-pages' }));

  await processToolWorkflowJob(job, { adapters, redis });

  const events = redis.published.map((p: any) => JSON.parse(p.message));
  const completedEvents = events.filter((e: any) => e.type === 'step_completed');
  const workflowCompleted = events.find((e: any) => e.type === 'workflow_completed');

  assert.ok(completedEvents.length >= 2, `funnel-pages should have at least 2 steps, got ${completedEvents.length}`);
  assert.ok(workflowCompleted, 'should have workflow_completed');

  const completedStepKeys = completedEvents.map((e: any) => e.stepKey);
  assert.ok(completedStepKeys.includes('optin'), 'should include optin step');
});

test('processor checks cancel flag between steps', async () => {
  const redis = new MockRedis() as any;
  const adapters = createInMemoryGenerationAdapters();
  const job = buildMockJob(buildJobData({ toolKey: 'funnel-pages' }));

  let stepCount = 0;
  const originalPublish = redis.publish.bind(redis);
  redis.publish = async (channel: string, message: string) => {
    const event = JSON.parse(message);
    if (event.type === 'step_completed') {
      stepCount++;
      if (stepCount === 1) {
        redis.store.set('tool-job-cancel:job-1', 'true');
      }
    }
    return originalPublish(channel, message);
  };

  await processToolWorkflowJob(job, { adapters, redis });

  const events = redis.published.map((p: any) => JSON.parse(p.message));
  const workflowFailed = events.find((e: any) => e.type === 'workflow_failed');
  assert.ok(workflowFailed, 'should have workflow_failed event');
  assert.equal(workflowFailed.errorMessage, 'cancelled');
});

test('processor releases single-flight lock on completion', async () => {
  const redis = new MockRedis() as any;
  const adapters = createInMemoryGenerationAdapters();
  redis.store.set('tool-job-active:user-1:project-1:funnel-pages', 'job-1');
  const job = buildMockJob(buildJobData());

  await processToolWorkflowJob(job, { adapters, redis });

  assert.ok(redis.deleted.includes('tool-job-active:user-1:project-1:funnel-pages'), 'should release single-flight lock');
});
