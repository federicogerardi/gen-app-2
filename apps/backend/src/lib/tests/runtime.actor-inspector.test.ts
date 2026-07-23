import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectActor } from '../runtime/actor-inspector';

const createMockActor = (snapshot: Record<string, unknown>) => ({
  getSnapshot: () => snapshot as any,
});

test('inspectActor shows machine id and state value', () => {
  const actor = createMockActor({
    machine: { id: 'testMachine' },
    value: 'idle',
    context: {},
    children: {},
  });

  const output = inspectActor(actor as any);
  assert.ok(output.includes('testMachine'));
  assert.ok(output.includes('idle'));
});

test('inspectActor shows nested state value', () => {
  const actor = createMockActor({
    machine: { id: 'parent' },
    value: { inner: 'active' },
    context: {},
    children: {},
  });

  const output = inspectActor(actor as any);
  assert.ok(output.includes('parent'));
  assert.ok(output.includes('inner:active'));
});

test('inspectActor shows step progress with status icons', () => {
  const actor = createMockActor({
    machine: { id: 'workflow' },
    value: 'running',
    context: {
      stepStates: [
        { key: 'step-a', status: 'done' },
        { key: 'step-b', status: 'running' },
        { key: 'step-c', status: 'idle' },
        { key: 'step-d', status: 'error', errorMessage: 'timeout' },
        { key: 'step-e', status: 'skipped' },
      ],
    },
    children: {},
  });

  const output = inspectActor(actor as any);
  assert.ok(output.includes('✅ step-a: done'));
  assert.ok(output.includes('⏳ step-b: running'));
  assert.ok(output.includes('⬜ step-c: idle'));
  assert.ok(output.includes('❌ step-d: error (timeout)'));
  assert.ok(output.includes('⏭️  step-e: skipped'));
});

test('inspectActor shows child actors', () => {
  const actor = createMockActor({
    machine: { id: 'parent' },
    value: 'active',
    context: {},
    children: {
      child1: {
        getSnapshot: () => ({
          machine: { id: 'child1' },
          value: 'running',
          context: {},
          children: {},
        }),
      },
    },
  });

  const output = inspectActor(actor as any);
  assert.ok(output.includes('child1'));
  assert.ok(output.includes('running'));
});

test('inspectActor respects maxDepth', () => {
  const actor = createMockActor({
    machine: { id: 'root' },
    value: 'active',
    context: {},
    children: {
      level1: {
        getSnapshot: () => ({
          machine: { id: 'level1' },
          value: 'running',
          context: {},
          children: {
            level2: {
              getSnapshot: () => ({
                machine: { id: 'level2' },
                value: 'deep',
                context: {},
                children: {},
              }),
            },
          },
        }),
      },
    },
  });

  const output = inspectActor(actor as any, { maxDepth: 1 });
  assert.ok(output.includes('level1'));
  assert.ok(output.includes('max depth reached'));
  assert.ok(!output.includes('level2'));
});

test('inspectActor shows context when showContext is true', () => {
  const actor = createMockActor({
    machine: { id: 'test' },
    value: 'idle',
    context: { requestId: 'req-123', data: 'value' },
    children: {},
  });

  const output = inspectActor(actor as any, { showContext: true });
  assert.ok(output.includes('requestId'));
  assert.ok(output.includes('req-123'));
});

test('inspectActor handles missing machine id gracefully', () => {
  const actor = createMockActor({
    value: 'idle',
    context: {},
    children: {},
  });

  const output = inspectActor(actor as any);
  assert.ok(output.includes('unknown'));
});

test('inspectActor handles child that throws on getSnapshot', () => {
  const actor = createMockActor({
    machine: { id: 'parent' },
    value: 'active',
    context: {},
    children: {
      broken: {
        getSnapshot: () => { throw new Error('actor destroyed'); },
      },
    },
  });

  const output = inspectActor(actor as any);
  assert.ok(output.includes('broken'));
  assert.ok(output.includes('[unavailable]'));
});
