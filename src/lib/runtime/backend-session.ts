import { createActor, waitFor } from 'xstate';

import type { GenerationAdapters } from '../adapters';
import { generationSystemMachine } from '../machines';
import {
  mapFailureReasonToBackendError,
  type BackendError,
} from './error-contract';
import {
  buildAuthOkEvent,
  buildRequestReceivedEvent,
  buildValidationOkEvent,
  type BackendGenerationRequest,
} from './request-contract';
import type { BackendStreamEvent } from './stream-contract';

export type BackendSessionResult = {
  status: 'completed' | 'failed';
  artifactId: string | null;
  content: string;
  streamEvents: BackendStreamEvent[];
  error: BackendError | null;
};

export type RunBackendGenerationSessionOptions = {
  onStreamEvent?: (event: BackendStreamEvent) => void;
};

export const runBackendGenerationSession = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
  options: RunBackendGenerationSessionOptions = {},
): Promise<BackendSessionResult> => {
  const actor = createActor(generationSystemMachine, {
    input: { adapters },
  });

  const streamEvents: BackendStreamEvent[] = [];
  let started = false;
  let lastEmittedSequence = 0;
  let currentArtifactId: string | null = null;
  let observedStreamActor: unknown = null;
  let streamSubscription: { unsubscribe: () => void } | null = null;

  const emitStreamEvent = (event: BackendStreamEvent) => {
    streamEvents.push(event);
    options.onStreamEvent?.(event);
  };

  const emitChunk = (sequence: unknown, chunk: unknown) => {
    if (
      typeof sequence !== 'number'
      || sequence <= lastEmittedSequence
      || typeof chunk !== 'string'
      || chunk.length === 0
      || !currentArtifactId
    ) {
      return;
    }

    emitStreamEvent({
      event: 'chunk',
      data: {
        artifactId: currentArtifactId,
        chunk,
        sequence,
      },
    });
    lastEmittedSequence = sequence;
  };

  const attachStreamObserver = (snapshot: unknown) => {
    const typedSnapshot = snapshot as {
      value?: unknown;
      context?: { artifactId?: string | null };
      children?: Record<string, unknown>;
    };

    if (typeof typedSnapshot.context?.artifactId === 'string') {
      currentArtifactId = typedSnapshot.context.artifactId;
    }

    if (String(typedSnapshot.value) !== 'streaming') {
      return;
    }

    const streamActor = typedSnapshot.children?.streamActor as
      | {
          subscribe?: (listener: (snapshot: unknown) => void) => { unsubscribe: () => void };
        }
      | undefined;

    if (!streamActor || streamActor === observedStreamActor || typeof streamActor.subscribe !== 'function') {
      return;
    }

    observedStreamActor = streamActor;
    streamSubscription?.unsubscribe();
    streamSubscription = streamActor.subscribe((streamSnapshot) => {
      const typedStreamSnapshot = streamSnapshot as {
        context?: {
          sequence?: unknown;
          lastChunk?: unknown;
        };
      };
      emitChunk(typedStreamSnapshot.context?.sequence, typedStreamSnapshot.context?.lastChunk);
    });
  };

  const emitIncrementalChunkFromSnapshot = (snapshot: unknown) => {
    const typedSnapshot = snapshot as {
      value?: unknown;
      context?: { artifactId?: string | null };
      children?: Record<string, unknown>;
    };

    attachStreamObserver(typedSnapshot);

    if (String(typedSnapshot.value) !== 'streaming' || !typedSnapshot.context?.artifactId) {
      return;
    }

    const streamActor = (typedSnapshot.children as Record<string, unknown>).streamActor as
      | { getSnapshot?: () => unknown }
      | undefined;
    const streamSnapshot = streamActor?.getSnapshot?.() as
      | {
          context?: {
            sequence?: unknown;
            lastChunk?: unknown;
          };
        }
      | undefined;

    const sequence =
      typeof streamSnapshot?.context?.sequence === 'number'
        ? streamSnapshot.context.sequence
        : null;
    const chunk =
      typeof streamSnapshot?.context?.lastChunk === 'string'
        ? streamSnapshot.context.lastChunk
        : null;

    if (sequence === null || !chunk) {
      return;
    }

    emitChunk(sequence, chunk);
  };

  actor.subscribe((snapshot) => {
    const stateValue = String(snapshot.value);
    if (!started && stateValue === 'streaming' && snapshot.context.artifactId) {
      emitStreamEvent({
        event: 'start',
        data: {
          requestId: snapshot.context.requestId,
          artifactId: snapshot.context.artifactId,
        },
      });
      started = true;
    }

    emitIncrementalChunkFromSnapshot(snapshot);
  });

  actor.start();
  actor.send(buildRequestReceivedEvent(request));
  actor.send(buildAuthOkEvent(request));
  actor.send(buildValidationOkEvent(request));

  const doneSnapshot = await waitFor(actor, (snapshot) => {
    const stateValue = String(snapshot.value);
    return stateValue === 'completed' || stateValue === 'failed';
  });

  const hasChunkEvent = streamEvents.some((event) => event.event === 'chunk');
  if (!hasChunkEvent && doneSnapshot.context.contentBuffer && doneSnapshot.context.artifactId) {
    emitStreamEvent({
      event: 'chunk',
      data: {
        artifactId: doneSnapshot.context.artifactId,
        chunk: doneSnapshot.context.contentBuffer,
        sequence: 1,
      },
    });
  }

  const status = String(doneSnapshot.value) === 'completed' ? 'completed' : 'failed';
  const error = status === 'failed'
    ? mapFailureReasonToBackendError(doneSnapshot.context.failureReason)
    : null;

  emitStreamEvent({
    event: 'terminal',
    data: {
      artifactId: doneSnapshot.context.artifactId,
      status,
      reason: doneSnapshot.context.failureReason,
    },
  });

  (streamSubscription as { unsubscribe: () => void } | null)?.unsubscribe();
  actor.stop();

  return {
    status,
    artifactId: doneSnapshot.context.artifactId,
    content: doneSnapshot.context.contentBuffer,
    streamEvents,
    error,
  };
};
