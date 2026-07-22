import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  buildJobChannel,
  createJobEventPublisher,
  subscribeToJobEvents,
  type JobProgressEvent,
} from '../runtime/job-event-bridge';

class MockRedis extends EventEmitter {
  published: Array<{ channel: string; message: string }> = [];
  subscribedChannels: Set<string> = new Set();
  unsubscribedChannels: string[] = [];
  publishResult = 1;

  async publish(channel: string, message: string): Promise<number> {
    this.published.push({ channel, message });
    return this.publishResult;
  }

  async subscribe(channel: string): Promise<void> {
    this.subscribedChannels.add(channel);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.subscribedChannels.delete(channel);
    this.unsubscribedChannels.push(channel);
  }

  emitToChannel(channel: string, message: string): void {
    if (this.subscribedChannels.has(channel)) {
      this.emit('message', channel, message);
    }
  }
}

test('buildJobChannel produces correct channel name', () => {
  assert.equal(buildJobChannel('job-123'), 'generation:job-123');
  assert.equal(buildJobChannel('abc-def'), 'generation:abc-def');
});

test('createJobEventPublisher.publish serializes and calls redis.publish', async () => {
  const redis = new MockRedis() as any;
  const publisher = createJobEventPublisher(redis);

  const event: JobProgressEvent = {
    type: 'step_started',
    jobId: 'job-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    stepKey: 'generate',
    stepIndex: 0,
    totalSteps: 3,
  };

  await publisher.publish(event);

  assert.equal(redis.published.length, 1);
  assert.equal(redis.published[0].channel, 'generation:job-1');

  const payload = JSON.parse(redis.published[0].message);
  assert.equal(payload.type, 'step_started');
  assert.equal(payload.jobId, 'job-1');
  assert.equal(payload.stepKey, 'generate');
});

test('createJobEventPublisher.publish does not throw when Redis is unavailable', async () => {
  const redis = {
    publish: async () => {
      throw new Error('Redis connection lost');
    },
  } as any;
  const publisher = createJobEventPublisher(redis);

  const event: JobProgressEvent = {
    type: 'step_completed',
    jobId: 'job-2',
    timestamp: '2026-01-01T00:00:00.000Z',
  };

  await assert.doesNotReject(() => publisher.publish(event));
});

test('subscribeToJobEvents subscribes to channel and invokes callback on message', async () => {
  const redis = new MockRedis() as any;
  const received: JobProgressEvent[] = [];

  const unsubscribe = await subscribeToJobEvents(redis, 'job-10', (event) => {
    received.push(event);
  });

  assert.ok(redis.subscribedChannels.has('generation:job-10'));

  const event: JobProgressEvent = {
    type: 'step_completed',
    jobId: 'job-10',
    timestamp: '2026-01-01T00:00:00.000Z',
    stepKey: 'output',
    status: 'done',
  };

  redis.emitToChannel('generation:job-10', JSON.stringify(event));

  assert.equal(received.length, 1);
  assert.equal(received[0]?.type, 'step_completed');
  assert.equal(received[0]?.stepKey, 'output');

  unsubscribe();
});

test('subscribeToJobEvents ignores unparseable messages', async () => {
  const redis = new MockRedis() as any;
  const received: JobProgressEvent[] = [];

  await subscribeToJobEvents(redis, 'job-11', (event) => {
    received.push(event);
  });

  redis.emitToChannel('generation:job-11', 'not-json');
  redis.emitToChannel('generation:job-11', '{broken');

  assert.equal(received.length, 0);
});

test('subscribeToJobEvents returns working unsubscribe function', async () => {
  const redis = new MockRedis() as any;
  const received: JobProgressEvent[] = [];

  const unsubscribe = await subscribeToJobEvents(redis, 'job-12', (event) => {
    received.push(event);
  });

  const event: JobProgressEvent = {
    type: 'step_started',
    jobId: 'job-12',
    timestamp: '2026-01-01T00:00:00.000Z',
  };

  redis.emitToChannel('generation:job-12', JSON.stringify(event));
  assert.equal(received.length, 1);

  unsubscribe();

  redis.emitToChannel('generation:job-12', JSON.stringify(event));
  assert.equal(received.length, 1);

  assert.deepEqual(redis.unsubscribedChannels, ['generation:job-12']);
});

test('subscribeToJobEvents does not receive events for other job channels', async () => {
  const redis = new MockRedis() as any;
  const received: JobProgressEvent[] = [];

  await subscribeToJobEvents(redis, 'job-20', (event) => {
    received.push(event);
  });

  const otherEvent: JobProgressEvent = {
    type: 'step_completed',
    jobId: 'job-99',
    timestamp: '2026-01-01T00:00:00.000Z',
  };

  redis.emitToChannel('generation:job-99', JSON.stringify(otherEvent));

  assert.equal(received.length, 0);
});
