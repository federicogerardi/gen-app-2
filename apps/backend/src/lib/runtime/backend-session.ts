import { createActor, waitFor } from 'xstate';

import type { GenerationAdapters } from '../adapters/generation';
import { generationSystemMachine } from '../machines';
import {
  mapFailureReasonToBackendError,
  type BackendError,
} from './error-contract';
import { createComponentLogger, LogComponent } from './log-components';
import {
  acceptChunkCandidate,
  hasChunkEvents,
} from './generation-session-chunk-acceptance';
import {
  buildTerminalStreamEvent,
  resolveTerminalStatus,
} from './generation-session-terminal';
import {
  buildAuthOkEvent,
  buildRequestReceivedEvent,
  buildValidationOkEvent,
  type BackendGenerationRequest,
} from './request-contract';
import type { StepLlmModelResolver } from './step-llm-model-resolver';
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
  modelResolver?: StepLlmModelResolver | undefined;
};

export const runBackendGenerationSession = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
  options: RunBackendGenerationSessionOptions = {},
): Promise<BackendSessionResult> => {
  const requestedStep =
    typeof request.input.step === 'string' && request.input.step.trim().length > 0
      ? request.input.step.trim()
      : '-';
  const requestedTone =
    typeof request.input.tone === 'string' && request.input.tone.trim().length > 0
      ? request.input.tone.trim()
      : '-';
  const correlationId = `run:${request.requestId}`;
  const log = createComponentLogger(LogComponent.BACKEND_SESSION);
  const sessionLog = log.child({ correlationId, requestId: request.requestId });

  sessionLog.info({
    projectId: request.projectId,
    sessionId: request.sessionId ?? '-',
    toolKey: request.toolKey ?? '-',
    workflowType: request.workflowType ?? '-',
    artifactType: request.artifactType,
    step: requestedStep,
    model: request.model,
    tone: requestedTone,
  }, 'session start');

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
    const artifactId = currentArtifactId;
    const accepted = acceptChunkCandidate({
      sequence,
      chunk,
      currentArtifactId: artifactId,
      lastEmittedSequence,
    });
    if (!accepted || !artifactId) {
      return;
    }

    emitStreamEvent({
      event: 'chunk',
      data: {
        artifactId,
        chunk: accepted.chunk,
        sequence: accepted.sequence,
      },
    });
    lastEmittedSequence = accepted.sequence;
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
  actor.send(buildRequestReceivedEvent(request, options.modelResolver));
  actor.send(buildAuthOkEvent(request));
  actor.send(buildValidationOkEvent(request));

  const doneSnapshot = await waitFor(actor, (snapshot) => {
    const stateValue = String(snapshot.value);
    return stateValue === 'completed' || stateValue === 'failed';
  });

  const hasChunkEvent = hasChunkEvents(streamEvents);
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

  const status = resolveTerminalStatus(String(doneSnapshot.value));
  const error = status === 'failed'
    ? mapFailureReasonToBackendError(doneSnapshot.context.failureReason)
    : null;

  sessionLog.info({
    status,
    artifactId: doneSnapshot.context.artifactId ?? '-',
    failureReason: doneSnapshot.context.failureReason ?? '-',
    contentLen: doneSnapshot.context.contentBuffer.length,
    step: requestedStep,
    model: request.model,
    tone: requestedTone,
  }, 'session terminal');

  emitStreamEvent(
    buildTerminalStreamEvent(doneSnapshot.context, status),
  );

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

export type BackendJsonSessionResult = {
  status: 'completed' | 'failed';
  artifactId: string | null;
  content: string;
  error: BackendError | null;
};

export const runBackendGenerationSessionAsJson = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
  options: RunBackendGenerationSessionOptions = {},
): Promise<BackendJsonSessionResult> => {
  const correlationId = `run-json:${request.requestId}`;
  const log = createComponentLogger(LogComponent.BACKEND_SESSION);
  const jsonLog = log.child({ correlationId, requestId: request.requestId });

  jsonLog.info({ projectId: request.projectId, mode: 'generate' }, 'json session start');

  const actor = createActor(generationSystemMachine, {
    input: {
      adapters,
      initialContext: { mode: 'generate' as const },
    },
  });

  actor.start();
  actor.send(buildRequestReceivedEvent(request, options.modelResolver));
  actor.send(buildAuthOkEvent(request));
  actor.send(buildValidationOkEvent(request));

  const doneSnapshot = await waitFor(actor, (snapshot) => {
    const stateValue = String(snapshot.value);
    return stateValue === 'completed' || stateValue === 'failed';
  });

  const status = resolveTerminalStatus(String(doneSnapshot.value));
  const error = status === 'failed'
    ? mapFailureReasonToBackendError(doneSnapshot.context.failureReason)
    : null;

  jsonLog.info({
    status,
    artifactId: doneSnapshot.context.artifactId ?? '-',
    failureReason: doneSnapshot.context.failureReason ?? '-',
    contentLen: doneSnapshot.context.contentBuffer.length,
  }, 'json session terminal');

  actor.stop();

  return {
    status,
    artifactId: doneSnapshot.context.artifactId,
    content: doneSnapshot.context.contentBuffer,
    error,
  };
};
