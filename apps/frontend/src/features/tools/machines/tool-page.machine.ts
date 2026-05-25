import { assign, sendTo, setup, stopChild, type ActorRefFrom } from 'xstate';
import { briefingUploadMachine } from './briefing-upload.machine';
import { generationLifecycleMachine } from './generation-lifecycle.machine';
import { hydrationMachine } from './hydration.machine';
import { toolFlowMachine } from './tool-flow.machine';
import { generateSessionId } from '../../../app/runtime/shared-utils';
import { buildReadinessSnapshot, deriveHasPrimaryTargetStep } from './tool-page-readiness';
import { buildDefaultViewModel, buildToolPageViewModel, canStartFromPolicy } from './tool-page-view-model';
import { normalizeHydrateRequest, normalizePendingHydration, readHydrationMachineOutput } from './tool-page-hydration';
import { buildEmptyProgressState, buildResetConfigState, buildSetProjectState, buildSyncProgressState } from './tool-page-machine-assignments';
import type { ToolPageContext, ToolPageEvent, ToolPageInput } from './tool-page.types';
import { STREAM_CONFIG } from '../../../app/config/stream-config';

export type { HydrationResult } from './hydration.machine';
export type { ReadinessReasonCode, ReadinessSnapshot } from './tool-page-readiness';
export type { ToolPageProgressState } from './tool-page-progress';
export type { ToolPageViewModel } from './tool-page-view-model';
export { resolveFlowProgressState, resolveRestoredCheckpointState } from './tool-page-progress';

export const toolPageMachine = setup({
  types: {
    context: {} as ToolPageContext,
    input: {} as ToolPageInput,
    events: {} as ToolPageEvent,
  },
  actors: {
    briefingUploadMachine,
    toolFlowMachine,
    generationLifecycleMachine,
    hydrationMachine,
  },
  guards: {
    canStartGeneration: ({ context }) => {
      return context.readiness.canStartFlow && canStartFromPolicy(context.viewModel.primaryActionPolicy);
    },
  },
  actions: {
    spawnBriefingActor: assign({
      briefingActorRef: ({ context, spawn }) => {
        if (context.briefingActorRef) {
          return context.briefingActorRef;
        }
        const actorRef = spawn('briefingUploadMachine', {
          id: 'briefingActor',
          input: {
            toolKey: context.toolKey,
            projectId: context.projectId,
            model: context.model,
            campaignObjective: context.campaignObjective,
            apiBaseUrl: context.apiBaseUrl,
            capabilities: context.capabilities,
            userId: context.userId,
          },
        });
        return actorRef as ActorRefFrom<typeof briefingUploadMachine>;
      },
    }),
    setProjectId: assign(({ context, event }) => buildSetProjectState(context, event)),
    setModel: assign({
      model: ({ event, context }) => (event.type === 'MODEL_CHANGED' ? event.model : context.model),
    }),
    setCampaignObjective: assign({
      campaignObjective: ({ event, context }) => (
        event.type === 'CAMPAIGN_OBJECTIVE_CHANGED' ? event.campaignObjective : context.campaignObjective
      ),
    }),
    setStepArtifactId: assign({
      stepArtifactIds: ({ event, context }) => {
        if (event.type !== 'STEP_ARTIFACT_UPDATED') {
          return context.stepArtifactIds;
        }
        return {
          ...context.stepArtifactIds,
          [event.step]: event.artifactId,
        };
      },
    }),
    clearGenerationError: assign({
      generationError: () => null,
    }),
    syncProgress: assign(({ context, event }) => buildSyncProgressState(context, event)),
    queueStepStart: assign({
      pendingStepStart: ({ context, event }) => {
        if (event.type !== 'REQUEST_STEP_START') {
          return context.pendingStepStart;
        }
        return {
          step: event.step,
          runRequestPrefix: event.runRequestPrefix,
        };
      },
    }),
    clearPendingStepStart: assign({
      pendingStepStart: () => null,
    }),
    setGenerationError: assign({
      generationError: () => 'Tool flow failed',
      viewModel: ({ context }) => buildToolPageViewModel({
        toolKey: context.toolKey,
        readiness: context.readiness,
        progress: context.progress,
        generationError: 'Tool flow failed',
      }),
    }),
    resetConfig: assign(({ context }) => buildResetConfigState(context)),
    sendBriefingSelected: sendTo(
      'briefingActor',
      ({ event }) => (event.type === 'BRIEFING_FILE_SELECTED'
        ? { type: 'FILE_SELECTED', file: event.file, sourceKey: event.sourceKey }
        : { type: 'RESET' }),
    ),
    sendBriefingExtractionRequested: sendTo('briefingActor', { type: 'EXTRACTION_REQUESTED' }),
    sendBriefingReset: sendTo('briefingActor', { type: 'RESET' }),
    sendBriefingInputSynced: sendTo('briefingActor', ({ context, event }) => ({
      type: 'INPUT_SYNCED',
      projectId: context.projectId,
      model: event.type === 'MODEL_CHANGED' ? event.model : context.model,
      campaignObjective: event.type === 'CAMPAIGN_OBJECTIVE_CHANGED'
        ? event.campaignObjective
        : context.campaignObjective,
      apiBaseUrl: context.apiBaseUrl,
      capabilities: context.capabilities,
      userId: context.userId,
    })),
    sendGenerationLifecycleStepDone: sendTo(
      'generationLifecycleActor',
      ({ event }) => (event.type === 'STEP_DONE' ? event : { type: 'CANCEL' }),
    ),
    sendGenerationLifecycleStepFailed: sendTo(
      'generationLifecycleActor',
      ({ event }) => (event.type === 'STEP_FAILED' ? event : { type: 'CANCEL' }),
    ),
    sendGenerationLifecycleRetryStep: sendTo('generationLifecycleActor', { type: 'RETRY_STEP' }),
    cancelGenerationLifecycle: sendTo('generationLifecycleActor', { type: 'CANCEL' }),
  },
}).createMachine({
  id: 'toolPageMachine',
  context: ({ input }) => ({
    toolKey: input.toolKey,
    sessionId: input.sessionId ?? generateSessionId(),
    projectId: input.projectId,
    model: input.model,
    campaignObjective: input.campaignObjective ?? '',
    registrySnapshotRef: input.registrySnapshotRef,
    apiBaseUrl: input.apiBaseUrl,
    capabilities: input.capabilities,
    userId: input.userId,
    briefingActorRef: null,
    stepArtifactIds: {},
    generationError: null,
    progress: buildEmptyProgressState(),
    readiness: buildReadinessSnapshot(input.projectId, false, false),
    viewModel: buildDefaultViewModel(
      input.toolKey,
      buildReadinessSnapshot(input.projectId, false, false),
    ),
    pendingStepStart: null,
    hydrationResult: null,
    hydrationError: null,
    pendingHydration: null,
  }),
  on: {
    PROGRESS_SYNCED: {
      actions: 'syncProgress',
    },
  },
  initial: 'configuring',
  states: {
    configuring: {
      entry: 'spawnBriefingActor',
      on: {
        PROJECT_SELECTED: {
          target: 'configuring',
          reenter: true,
          actions: ['setProjectId', stopChild('briefingActor')],
        },
        MODEL_CHANGED: {
          actions: ['setModel', 'sendBriefingInputSynced'],
        },
        CAMPAIGN_OBJECTIVE_CHANGED: {
          actions: ['setCampaignObjective', 'sendBriefingInputSynced'],
        },
        STEP_ARTIFACT_UPDATED: {
          actions: 'setStepArtifactId',
        },
        BRIEFING_FILE_SELECTED: {
          actions: 'sendBriefingSelected',
        },
        BRIEFING_EXTRACTION_REQUESTED: {
          actions: 'sendBriefingExtractionRequested',
        },
        BRIEFING_RESET: {
          actions: 'sendBriefingReset',
        },
        REQUEST_STEP_START: [
          {
            guard: 'canStartGeneration',
            target: 'generating',
            actions: ['queueStepStart', 'clearGenerationError'],
          },
        ],
        START_GENERATION: [
          {
            guard: 'canStartGeneration',
            target: 'generating',
            actions: 'clearGenerationError',
          },
        ],
        RESET: {
          target: 'configuring',
          reenter: true,
          actions: ['resetConfig', stopChild('briefingActor')],
        },
        HYDRATE_REQUESTED: {
          target: 'hydrating',
          actions: assign(({ event }) => ({
            pendingHydration: normalizeHydrateRequest(event),
            hydrationError: null,
          })),
        },
      },
    },
    hydrating: {
      invoke: {
        id: 'hydrationActor',
        src: 'hydrationMachine',
        input: ({ context }) => ({
          request: {
            ...normalizePendingHydration(context.pendingHydration, 'new'),
          },
          projectId: context.projectId,
          apiBaseUrl: context.apiBaseUrl,
          capabilities: context.capabilities,
        }),
        onDone: [
          {
            guard: ({ event }) => readHydrationMachineOutput(event).status === 'success',
            target: 'configuring',
            actions: [
              assign(({ context, event }) => {
                const output = readHydrationMachineOutput(event);
                const hydrationResult = output.status === 'success' ? output.hydration : null;
                const intent = normalizePendingHydration(context.pendingHydration, 'new').intent;
                const hasPrimaryTargetStep = deriveHasPrimaryTargetStep(context.toolKey);
                const readiness = buildReadinessSnapshot(context.projectId, true, hasPrimaryTargetStep);
                return {
                  hydrationResult,
                  hydrationError: null,
                  pendingHydration: null,
                  readiness,
                  viewModel: buildToolPageViewModel({
                    toolKey: context.toolKey,
                    intent,
                    readiness,
                    progress: context.progress,
                    generationError: context.generationError,
                  }),
                };
              }),
              sendTo('briefingActor', ({ event }) => {
                const output = readHydrationMachineOutput(event);
                const result = output.status === 'success' ? output.hydration : null;
                if (result === null) {
                  return { type: 'RESET' as const };
                }
                return {
                  type: 'EXTRACTION_RECOVERED' as const,
                  artifactId: result.extractionArtifactId,
                  payload: result.extractionPayload,
                  briefingId: result.briefingId,
                  normalizedText: result.normalizedText,
                  parsedFormat: result.parsedFormat,
                  ...(result.briefingFileName != null && { fileName: result.briefingFileName }),
                };
              }),
            ],
          },
          {
            target: 'configuring',
            actions: assign(({ context, event }) => {
              const output = readHydrationMachineOutput(event);
              const reason = output.status === 'error' ? output.reason : 'hydration_failed';
              return {
                hydrationError: reason,
                hydrationResult: null,
                pendingHydration: null,
                viewModel: buildToolPageViewModel({
                  toolKey: context.toolKey,
                  readiness: context.readiness,
                  progress: context.progress,
                  generationError: context.generationError,
                  hydrationError: reason,
                }),
              };
            }),
          },
        ],
      },
      on: {
        HYDRATE_REQUESTED: {
          target: 'hydrating',
          reenter: true,
          actions: assign(({ event }) => ({
            pendingHydration: normalizeHydrateRequest(event),
            hydrationError: null,
          })),
        },
        RESET: {
          target: 'configuring',
          reenter: true,
          actions: ['resetConfig', stopChild('briefingActor')],
        },
      },
    },
    generating: {
      invoke: {
        id: 'generationLifecycleActor',
        src: 'generationLifecycleMachine',
        input: ({ context }) => ({
          toolKey: context.toolKey,
          maxRetries: STREAM_CONFIG.defaultMaxRetries,
          initialStep: context.pendingStepStart?.step ?? null,
        }),
        onDone: {
          target: 'completed',
          actions: 'clearGenerationError',
        },
      },
      on: {
        STEP_DONE: {
          actions: 'sendGenerationLifecycleStepDone',
        },
        STEP_FAILED: {
          actions: 'sendGenerationLifecycleStepFailed',
        },
        RETRY_STEP: {
          actions: 'sendGenerationLifecycleRetryStep',
        },
        CANCEL_GENERATION: {
          target: 'configuring',
        },
        STEP_REQUEST_DISPATCHED: {
          actions: 'clearPendingStepStart',
        },
        RESET: {
          target: 'configuring',
          reenter: true,
          actions: ['cancelGenerationLifecycle', 'resetConfig', stopChild('briefingActor')],
        },
      },
    },
    completed: {
      on: {
        RESET: {
          target: 'configuring',
          reenter: true,
          actions: ['resetConfig', stopChild('briefingActor')],
        },
      },
    },
  },
});
