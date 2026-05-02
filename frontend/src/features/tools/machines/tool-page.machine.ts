import { assign, raise, sendTo, setup, stopChild, type ActorRefFrom } from 'xstate';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { briefingUploadMachine } from './briefing-upload.machine';
import { toolFlowMachine, type SupportedTool, type ToolStep } from './tool-flow.machine';

export type ToolPageContext = {
  toolKey: SupportedTool;
  projectId: string;
  model: string;
  registrySnapshotRef: string;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
  userId: string | null;
  briefingActorRef: ActorRefFrom<typeof briefingUploadMachine> | null;
  stepArtifactIds: Partial<Record<ToolStep, string>>;
  generationError: string | null;
};

type ToolPageInput = {
  toolKey: SupportedTool;
  projectId: string;
  model: string;
  registrySnapshotRef: string;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
  userId: string | null;
};

export type ToolPageEvent =
  | { type: 'PROJECT_SELECTED'; projectId: string }
  | { type: 'MODEL_CHANGED'; model: string }
  | { type: 'STEP_ARTIFACT_UPDATED'; step: ToolStep; artifactId: string }
  | { type: 'BRIEFING_FILE_SELECTED'; file: File }
  | { type: 'BRIEFING_RESET' }
  | { type: 'START_GENERATION' }
  | { type: 'CANCEL_GENERATION' }
  | { type: 'STEP_DONE'; step: ToolStep }
  | { type: 'STEP_FAILED'; step: ToolStep; message: string }
  | { type: 'RETRY_STEP' }
  | { type: 'RESET' }
  | { type: 'INTERNAL_CANCELLED' };

export const toolPageMachine = setup({
  types: {
    context: {} as ToolPageContext,
    input: {} as ToolPageInput,
    events: {} as ToolPageEvent,
  },
  actors: {
    briefingUploadMachine,
    toolFlowMachine,
  },
  guards: {
    canStartGeneration: ({ context }) => {
      if (context.projectId.trim().length === 0) {
        return false;
      }

      return context.briefingActorRef?.getSnapshot().matches('ready') ?? false;
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
            apiBaseUrl: context.apiBaseUrl,
            capabilities: context.capabilities,
            userId: context.userId,
          },
        });

        return actorRef as ActorRefFrom<typeof briefingUploadMachine>;
      },
    }),
    setProjectId: assign({
      projectId: ({ event, context }) => (event.type === 'PROJECT_SELECTED' ? event.projectId : context.projectId),
      generationError: () => null,
      stepArtifactIds: () => ({}),
      briefingActorRef: () => null,
    }),
    setModel: assign({
      model: ({ event, context }) => (event.type === 'MODEL_CHANGED' ? event.model : context.model),
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
    setGenerationError: assign({
      generationError: () => 'Tool flow failed',
    }),
    resetConfig: assign(({ context }) => ({
      ...context,
      generationError: null,
      stepArtifactIds: {},
      briefingActorRef: null,
    })),
    sendBriefingSelected: sendTo(
      'briefingActor',
      ({ event }) => (event.type === 'BRIEFING_FILE_SELECTED'
        ? { type: 'FILE_SELECTED', file: event.file }
        : { type: 'RESET' }),
    ),
    sendBriefingReset: sendTo('briefingActor', { type: 'RESET' }),
    startToolFlow: sendTo('toolFlowActor', { type: 'START' }),
    cancelToolFlow: sendTo('toolFlowActor', { type: 'RESET' }),
    forwardStepDone: sendTo(
      'toolFlowActor',
      ({ event }) => (event.type === 'STEP_DONE' ? event : { type: 'START' }),
    ),
    forwardStepFailed: sendTo(
      'toolFlowActor',
      ({ event }) => (event.type === 'STEP_FAILED' ? event : { type: 'START' }),
    ),
    forwardRetryStep: sendTo('toolFlowActor', { type: 'RETRY_STEP' }),
  },
}).createMachine({
  id: 'toolPageMachine',
  context: ({ input }) => ({
    toolKey: input.toolKey,
    projectId: input.projectId,
    model: input.model,
    registrySnapshotRef: input.registrySnapshotRef,
    apiBaseUrl: input.apiBaseUrl,
    capabilities: input.capabilities,
    userId: input.userId,
    briefingActorRef: null,
    stepArtifactIds: {},
    generationError: null,
  }),
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
          actions: 'setModel',
        },
        STEP_ARTIFACT_UPDATED: {
          actions: 'setStepArtifactId',
        },
        BRIEFING_FILE_SELECTED: {
          actions: 'sendBriefingSelected',
        },
        BRIEFING_RESET: {
          actions: 'sendBriefingReset',
        },
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
      },
    },
    generating: {
      entry: 'startToolFlow',
      invoke: {
        id: 'toolFlowActor',
        src: 'toolFlowMachine',
        input: ({ context }) => ({
          tool: context.toolKey,
          maxRetries: 3,
        }),
        onDone: {
          target: 'completed',
          actions: 'clearGenerationError',
        },
        onError: {
          target: 'configuring',
          actions: 'setGenerationError',
        },
      },
      on: {
        STEP_DONE: {
          actions: 'forwardStepDone',
        },
        STEP_FAILED: {
          actions: 'forwardStepFailed',
        },
        RETRY_STEP: {
          actions: 'forwardRetryStep',
        },
        CANCEL_GENERATION: {
          actions: ['cancelToolFlow', raise({ type: 'INTERNAL_CANCELLED' })],
        },
        INTERNAL_CANCELLED: {
          target: 'configuring',
          actions: 'clearGenerationError',
        },
        RESET: {
          target: 'configuring',
          reenter: true,
          actions: ['cancelToolFlow', 'resetConfig', stopChild('briefingActor')],
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
