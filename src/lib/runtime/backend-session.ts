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

export const runBackendGenerationSession = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
): Promise<BackendSessionResult> => {
  const actor = createActor(generationSystemMachine, {
    input: { adapters },
  });

  const streamEvents: BackendStreamEvent[] = [];
  let started = false;

  actor.subscribe((snapshot) => {
    const stateValue = String(snapshot.value);
    if (!started && stateValue === 'streaming' && snapshot.context.artifactId) {
      streamEvents.push({
        event: 'start',
        data: {
          requestId: snapshot.context.requestId,
          artifactId: snapshot.context.artifactId,
        },
      });
      started = true;
    }
  });

  actor.start();
  actor.send(buildRequestReceivedEvent(request));
  actor.send(buildAuthOkEvent(request));
  actor.send(buildValidationOkEvent(request));

  const doneSnapshot = await waitFor(actor, (snapshot) => {
    const stateValue = String(snapshot.value);
    return stateValue === 'completed' || stateValue === 'failed';
  });

  if (doneSnapshot.context.contentBuffer && doneSnapshot.context.artifactId) {
    streamEvents.push({
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

  streamEvents.push({
    event: 'terminal',
    data: {
      artifactId: doneSnapshot.context.artifactId,
      status,
      reason: doneSnapshot.context.failureReason,
    },
  });

  actor.stop();

  return {
    status,
    artifactId: doneSnapshot.context.artifactId,
    content: doneSnapshot.context.contentBuffer,
    streamEvents,
    error,
  };
};
