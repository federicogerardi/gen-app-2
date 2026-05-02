import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor, setup } from 'xstate';

vi.mock('./briefing-upload.machine', () => {
  const briefingUploadMachine = setup({
    types: {
      context: {} as {},
      events: {} as { type: 'FILE_SELECTED'; file: File } | { type: 'RESET' },
      input: {} as {
        toolKey: 'funnel-pages' | 'nextland';
        projectId: string;
        apiBaseUrl: string;
        capabilities: Record<string, unknown>;
        userId: string | null;
      },
    },
  }).createMachine({
    id: 'briefingUploadMachine',
    initial: 'idle',
    states: {
      idle: {
        on: {
          FILE_SELECTED: { target: 'ready' },
          RESET: { target: 'idle' },
        },
      },
      ready: {
        on: {
          RESET: { target: 'idle' },
        },
      },
    },
  });

  return { briefingUploadMachine };
});

import { toolPageMachine } from './tool-page.machine';

const createToolPageActor = () => {
  const actor = createActor(toolPageMachine, {
    input: {
      toolKey: 'funnel-pages',
      projectId: 'project-1',
      model: 'openrouter/auto',
      registrySnapshotRef: 'snapshot:default',
      apiBaseUrl: '',
      capabilities: { toolsUpload: true },
      userId: 'user-1',
    },
  });

  actor.start();
  return actor;
};

describe('toolPageMachine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks START_GENERATION when briefing is not ready', () => {
    const actor = createToolPageActor();

    expect(actor.getSnapshot().context.briefingActorRef).not.toBeNull();

    actor.send({ type: 'START_GENERATION' });

    expect(actor.getSnapshot().value).toBe('configuring');
  });

  it('transitions configuring -> generating -> completed when briefing is ready and steps finish', () => {
    const actor = createToolPageActor();

    actor.send({
      type: 'BRIEFING_FILE_SELECTED',
      file: new File(['brief'], 'brief.md', { type: 'text/markdown' }),
    });

    expect(actor.getSnapshot().context.briefingActorRef?.getSnapshot().matches('ready')).toBe(true);

    actor.send({ type: 'START_GENERATION' });
    expect(actor.getSnapshot().value).toBe('generating');

    // If START is not forwarded to toolFlowActor, these STEP_DONE events are ignored and state never completes.
    actor.send({ type: 'STEP_DONE', step: 'optin' });
    actor.send({ type: 'STEP_DONE', step: 'quiz' });
    actor.send({ type: 'STEP_DONE', step: 'vsl' });

    expect(actor.getSnapshot().value).toBe('completed');
  });

  it('resets completed state back to configuring', () => {
    const actor = createToolPageActor();

    actor.send({
      type: 'BRIEFING_FILE_SELECTED',
      file: new File(['brief'], 'brief.md', { type: 'text/markdown' }),
    });
    actor.send({ type: 'START_GENERATION' });
    actor.send({ type: 'STEP_DONE', step: 'optin' });
    actor.send({ type: 'STEP_DONE', step: 'quiz' });
    actor.send({ type: 'STEP_DONE', step: 'vsl' });

    expect(actor.getSnapshot().value).toBe('completed');

    actor.send({ type: 'RESET' });

    expect(actor.getSnapshot().value).toBe('configuring');
    expect(actor.getSnapshot().context.briefingActorRef).not.toBeNull();
  });

  it('propagates CANCEL_GENERATION and returns to configuring', () => {
    const actor = createToolPageActor();

    actor.send({
      type: 'BRIEFING_FILE_SELECTED',
      file: new File(['brief'], 'brief.md', { type: 'text/markdown' }),
    });
    actor.send({ type: 'START_GENERATION' });

    expect(actor.getSnapshot().value).toBe('generating');

    actor.send({ type: 'CANCEL_GENERATION' });

    expect(actor.getSnapshot().value).toBe('configuring');
  });
});
