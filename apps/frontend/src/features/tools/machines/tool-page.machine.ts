import { assign, sendTo, setup, stopChild, type ActorRefFrom } from 'xstate';
import { briefingUploadMachine } from './briefing-upload.machine';
import { generationLifecycleMachine } from './generation-lifecycle.machine';
import { hydrationMachine } from './hydration.machine';
import { generateSessionId } from '../../../app/runtime/shared-utils';
import { buildReadinessSnapshot, deriveHasPrimaryTargetStep } from './tool-page-readiness';
import { buildReactiveViewModel, canStartFromPolicy } from './tool-page-view-model';
import { normalizeHydrateRequest, normalizePendingHydration, readHydrationMachineOutput } from './tool-page-hydration';
import { buildEmptyProgressState, buildResetConfigState, buildSetProjectState, buildSyncProgressState } from './tool-page-machine-assignments';
import type { ToolPageContext, ToolPageEvent, ToolPageInput } from './tool-page.types';
import type { BriefingActorInputEvent, GenerationLifecycleInputEvent } from './tool-page-actor-contracts';
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
    generationLifecycleMachine,
    hydrationMachine,
  },
  guards: {
    canStartGeneration: ({ context }) => {
      const policy = buildReactiveViewModel(context).primaryActionPolicy;
      const result = context.readiness.canStartFlow && canStartFromPolicy(policy);
      if (import.meta.env.DEV) console.info('[tool-page][machine] canStartGeneration:', { canStartFlow: context.readiness.canStartFlow, policy, canStartFromPolicy: canStartFromPolicy(policy), result, projectId: context.projectId, readiness: context.readiness });
      return result;
    },
    // Sprint 4 Session 2 (Phase 1 Step 6, Race D): drop the redundant second
    // CANCEL_GENERATION issued when the bridge branch (b) failure path and the
    // user-initiated handleCancelGeneration fire within the same clock cycle.
    // Permissive signal: returns true when there is anything to cancel — either
    // an enqueued step start, an active run request prefix, or accumulated flow
    // progress (completed steps or checkpoint). After the first CANCEL_GENERATION
    // runs resetConfig, all three clear to null/false so the duplicate CANCEL
    // becomes a no-op drop instead of a redundant re-entering transition. Note
    // that XState v5 guards do not expose `state`, so we rely on context fields;
    // START_GENERATION entries reach `generating` without pendingStepStart but
    // their preexisting progress makes the guard permissive in that branch too.
    canCancelGeneration: ({ context }) =>
      context.pendingStepStart !== null
      || context.runRequestPrefix !== null
      || context.progress.completedSteps.size > 0
      || context.progress.lastCheckpointStep !== null,
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
    clearError: assign({
      errorMessage: () => null,
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
    resetConfig: assign(({ context }) => buildResetConfigState(context)),
    // DDD-163: Action A — consolidate briefing file/upload/reset commands
    forwardBriefingCommand: sendTo(
      'briefingActor',
      ({ event }): BriefingActorInputEvent => {
        if (event.type === 'BRIEFING_FILE_SELECTED') {
          return {
            type: 'FILE_SELECTED',
            file: event.file,
            ...(event.sourceKey != null && { sourceKey: event.sourceKey }),
          };
        }
        if (event.type === 'BRIEFING_EXTRACTION_REQUESTED') return { type: 'EXTRACTION_REQUESTED' };
        return { type: 'RESET' };
      },
    ),
    // DDD-163: Action B — sync context to briefing actor (rename of sendBriefingInputSynced)
    syncBriefingContext: sendTo('briefingActor', ({ context, event }): BriefingActorInputEvent => ({
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
    // DDD-163: Action C — extract anonymous hydration sendTo (#9 → named)
    recoverBriefingFromHydration: sendTo('briefingActor', ({ event }): BriefingActorInputEvent => {
      const output = readHydrationMachineOutput(event);
      const result = output.status === 'success' ? output.hydration : null;
      if (result === null) {
        return { type: 'RESET' };
      }
      return {
        type: 'EXTRACTION_RECOVERED',
        artifactId: result.extractionArtifactId,
        payload: result.extractionPayload,
        briefingId: result.briefingId,
        normalizedText: result.normalizedText,
        parsedFormat: result.parsedFormat,
        ...(result.briefingFileName != null && { fileName: result.briefingFileName }),
      };
    }),
    // DDD-163: Action D — consolidate step done/failed forwarding
    forwardStepOutcomeToLifecycle: sendTo(
      'generationLifecycleActor',
      ({ event }): GenerationLifecycleInputEvent => {
        if (event.type === 'STEP_DONE') return event;
        if (event.type === 'STEP_FAILED') return event;
        return { type: 'CANCEL' };
      },
    ),
    // DDD-163: Action E — consolidate retry/cancel control signals
    controlGenerationLifecycle: sendTo(
      'generationLifecycleActor',
      ({ event }): GenerationLifecycleInputEvent => {
        if (event.type === 'RETRY_STEP') return { type: 'RETRY_STEP' };
        return { type: 'CANCEL' };
      },
    ),
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
    errorMessage: null,
    progress: buildEmptyProgressState(),
    readiness: buildReadinessSnapshot(input.projectId, false, false),
    intent: 'new' as const,
    runRequestPrefix: null,
    pendingStepStart: null,
    hydrationResult: null,
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
      initial: 'clean',
      states: {
        clean: {},
        hydrationFailed: {
          on: {
            HYDRATE_REQUESTED: {
              target: '#toolPageMachine.hydrating',
              actions: assign(({ event }) => ({
                pendingHydration: normalizeHydrateRequest(event),
                errorMessage: null,
                intent: event.intent,
              })),
            },
          },
        },
        generationFailed: {
          on: {
            REQUEST_STEP_START: [
              {
                guard: 'canStartGeneration',
                target: '#toolPageMachine.generating',
                actions: 'queueStepStart',
              },
            ],
            START_GENERATION: [
              {
                guard: 'canStartGeneration',
                target: '#toolPageMachine.generating',
              },
            ],
          },
        },
      },
      on: {
        PROJECT_SELECTED: {
          target: '.clean',
          reenter: true,
          actions: ['setProjectId', stopChild('briefingActor')],
        },
        MODEL_CHANGED: {
          actions: ['setModel', 'syncBriefingContext'],
        },
        CAMPAIGN_OBJECTIVE_CHANGED: {
          actions: ['setCampaignObjective', 'syncBriefingContext'],
        },
        STEP_ARTIFACT_UPDATED: {
          actions: 'setStepArtifactId',
        },
        BRIEFING_FILE_SELECTED: {
          actions: 'forwardBriefingCommand',
        },
        BRIEFING_EXTRACTION_REQUESTED: {
          actions: 'forwardBriefingCommand',
        },
        BRIEFING_RESET: {
          actions: 'forwardBriefingCommand',
        },
        REQUEST_STEP_START: [
          {
            guard: 'canStartGeneration',
            target: 'generating',
            actions: ['queueStepStart', 'clearError'],
          },
        ],
        START_GENERATION: [
          {
            guard: 'canStartGeneration',
            target: 'generating',
            actions: 'clearError',
          },
        ],
        CANCEL_GENERATION: {
          // Sprint 4 Session 2 (Phase 1 Step 6, Race D): drop redundant cancels.
          guard: 'canCancelGeneration',
          target: '.clean',
          reenter: true,
          actions: ['resetConfig', stopChild('briefingActor')],
        },
        RESET: {
          target: '.clean',
          reenter: true,
          actions: ['resetConfig', stopChild('briefingActor')],
        },
        HYDRATE_REQUESTED: {
          target: 'hydrating',
          actions: assign(({ event }) => ({
            pendingHydration: normalizeHydrateRequest(event),
            errorMessage: null,
            intent: event.intent,
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
                  pendingHydration: null,
                  readiness,
                  intent,
                };
              }),
              'recoverBriefingFromHydration',
            ],
          },
          {
            target: 'configuring.hydrationFailed',
            actions: assign(({ event }) => {
              const output = readHydrationMachineOutput(event);
              const reason = output.status === 'error' ? output.reason : 'hydration_failed';
              return {
                errorMessage: reason,
                hydrationResult: null,
                pendingHydration: null,
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
            errorMessage: null,
            intent: event.intent,
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
          actions: 'clearError',
        },
        onError: {
          target: 'configuring.generationFailed',
          actions: assign(({ event }) => ({
            errorMessage: 'error' in event ? String(event.error) : 'Generation failed',
          })),
        },
      },
      on: {
        STEP_DONE: {
          actions: 'forwardStepOutcomeToLifecycle',
        },
        STEP_FAILED: {
          actions: 'forwardStepOutcomeToLifecycle',
        },
        RETRY_STEP: {
          actions: 'controlGenerationLifecycle',
        },
        CANCEL_GENERATION: {
          // Sprint 4 Session 2 (Phase 1 Step 6, Race D): the first cancel from
          // `generating` always proceeds — the redundant second cancel will be
          // dropped by the guard on the configuring handler below.
          target: 'configuring.clean',
        },
        // Sprint 4 Session 2: while in `generating`, accept REQUEST_STEP_START to
        // enqueue the next step (auto-chain) via the same queue used by manual
        // requests. This restores XState authority over dispatch — the bridge
        // no longer calls startGenerationStep directly. No state transition: the
        // pendingStepStart field is updated and the reducer-bridge reacts.
        REQUEST_STEP_START: {
          actions: 'queueStepStart',
        },
        STEP_REQUEST_DISPATCHED: {
          actions: 'clearPendingStepStart',
        },
        RESET: {
          target: 'configuring.clean',
          reenter: true,
          actions: ['controlGenerationLifecycle', 'resetConfig', stopChild('briefingActor')],
        },
      },
    },
    completed: {
      on: {
        RESET: {
          target: 'configuring.clean',
          reenter: true,
          actions: ['resetConfig', stopChild('briefingActor')],
        },
      },
    },
  },
});
