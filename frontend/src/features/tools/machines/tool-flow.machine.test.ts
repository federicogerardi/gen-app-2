import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { toolFlowMachine } from './tool-flow.machine';

const startActor = (tool: 'funnel-pages' | 'nextland', maxRetries = 3) => {
  const actor = createActor(toolFlowMachine, { input: { tool, maxRetries } });
  actor.start();
  return actor;
};

describe('toolFlowMachine – funnel-pages', () => {
  it('starts in idle state', () => {
    const actor = startActor('funnel-pages');
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('transitions to running on START', () => {
    const actor = startActor('funnel-pages');
    actor.send({ type: 'START' });
    expect(actor.getSnapshot().value).toBe('running');
    expect(actor.getSnapshot().context.stepStatus.optin).toBe('running');
  });

  it('advances step on STEP_DONE optin -> quiz', () => {
    const actor = startActor('funnel-pages');
    actor.send({ type: 'START' });
    actor.send({ type: 'STEP_DONE', step: 'optin' });
    expect(actor.getSnapshot().value).toBe('running');
    expect(actor.getSnapshot().context.stepStatus.optin).toBe('done');
    expect(actor.getSnapshot().context.stepStatus.quiz).toBe('running');
  });

  it('advances step quiz -> vsl', () => {
    const actor = startActor('funnel-pages');
    actor.send({ type: 'START' });
    actor.send({ type: 'STEP_DONE', step: 'optin' });
    actor.send({ type: 'STEP_DONE', step: 'quiz' });
    expect(actor.getSnapshot().context.stepStatus.vsl).toBe('running');
  });

  it('transitions to done after vsl completes', () => {
    const actor = startActor('funnel-pages');
    actor.send({ type: 'START' });
    actor.send({ type: 'STEP_DONE', step: 'optin' });
    actor.send({ type: 'STEP_DONE', step: 'quiz' });
    actor.send({ type: 'STEP_DONE', step: 'vsl' });
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('transitions to error on STEP_FAILED', () => {
    const actor = startActor('funnel-pages');
    actor.send({ type: 'START' });
    actor.send({ type: 'STEP_FAILED', step: 'optin', message: 'timeout' });
    expect(actor.getSnapshot().value).toBe('error');
    expect(actor.getSnapshot().context.errorMessage).toBe('timeout');
  });

  it('allows retry if under max retries', () => {
    const actor = startActor('funnel-pages', 3);
    actor.send({ type: 'START' });
    actor.send({ type: 'STEP_FAILED', step: 'optin', message: 'e' });
    expect(actor.getSnapshot().value).toBe('error');
    actor.send({ type: 'RETRY_STEP' });
    expect(actor.getSnapshot().value).toBe('running');
  });

  it('stays in error (retry exhausted) after maxRetries', () => {
    const actor = startActor('funnel-pages', 1);
    actor.send({ type: 'START' });
    actor.send({ type: 'STEP_FAILED', step: 'optin', message: 'e1' });
    actor.send({ type: 'RETRY_STEP' }); // retry 1 -> running
    actor.send({ type: 'STEP_FAILED', step: 'optin', message: 'e2' }); // retry count = 2 > maxRetries 1
    actor.send({ type: 'RETRY_STEP' }); // should transition to 'failed' (exhausted)
    expect(actor.getSnapshot().value).toBe('failed');
  });

  it('resets to idle on RESET', () => {
    const actor = startActor('funnel-pages');
    actor.send({ type: 'START' });
    actor.send({ type: 'STEP_DONE', step: 'optin' });
    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.currentIndex).toBe(0);
  });
});

describe('toolFlowMachine – nextland', () => {
  it('completes landing -> thank_you', () => {
    const actor = startActor('nextland');
    actor.send({ type: 'START' });
    actor.send({ type: 'STEP_DONE', step: 'landing' });
    actor.send({ type: 'STEP_DONE', step: 'thank_you' });
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('blocks out-of-order step: thank_you before landing', () => {
    const actor = startActor('nextland');
    actor.send({ type: 'START' });
    // landing is current; sending thank_you should be ignored
    actor.send({ type: 'STEP_DONE', step: 'thank_you' });
    // still running on landing
    expect(actor.getSnapshot().context.stepStatus.landing).toBe('running');
    expect(actor.getSnapshot().value).toBe('running');
  });
});
