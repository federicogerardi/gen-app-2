import { assign, raise, sendTo, setup, stopChild, type ActorRefFrom } from 'xstate';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { briefingUploadMachine } from './briefing-upload.machine';
import { toolFlowMachine, type SupportedTool, type ToolStep } from './tool-flow.machine';
import { toolStepOrder } from '../runtime/tool-generation-engine';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import {
  belongsToTool,
  buildLatestArtifactByStep,
  collectCompletedRunSteps,
  collectCompletedStepsByTool,
} from '../../generation/runtime/step-hydration';

export type ToolPageProgressState = {
  completedSteps: Set<ToolStep>;
  latestArtifactByStep: Partial<Record<ToolStep, GenerationArtifact>>;
  lastCheckpointStep: ToolStep | null;
};

export type ToolPageReadinessReasonCode =
  | 'missing_project'
  | 'missing_extraction_context'
  | 'missing_primary_target_step';

export type ToolPageReadinessSnapshot = {
  canStartFlow: boolean;
  hasProject: boolean;
  hasExtractionContext: boolean;
  hasPrimaryTargetStep: boolean;
  reasonCodes: ToolPageReadinessReasonCode[];
};

const buildReadinessSnapshot = (
  projectId: string,
  hasExtractionContext: boolean,
  hasPrimaryTargetStep: boolean,
): ToolPageReadinessSnapshot => {
  const hasProject = projectId.trim().length > 0;
  const reasonCodes: ToolPageReadinessReasonCode[] = [];

  if (!hasProject) {
    reasonCodes.push('missing_project');
  }

  if (!hasExtractionContext) {
    reasonCodes.push('missing_extraction_context');
  }

  if (!hasPrimaryTargetStep) {
    reasonCodes.push('missing_primary_target_step');
  }

  return {
    canStartFlow: reasonCodes.length === 0,
    hasProject,
    hasExtractionContext,
    hasPrimaryTargetStep,
    reasonCodes,
  };
};

const readArtifactStep = (artifact: GenerationArtifact | null): ToolStep | null => {
  const step = artifact?.sourceRequest.input?.step;
  return typeof step === 'string' ? step as ToolStep : null;
};

const readStepDependencyArtifactIdsByStep = (
  artifact: GenerationArtifact | null,
): Partial<Record<ToolStep, string>> => {
  const raw = artifact?.sourceRequest.input?.stepDependencyArtifactIdsByStep;
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return Object.entries(raw).reduce<Partial<Record<ToolStep, string>>>((acc, [step, artifactId]) => {
    if (typeof artifactId === 'string' && artifactId.trim().length > 0) {
      acc[step as ToolStep] = artifactId;
    }
    return acc;
  }, {});
};

export const resolveRestoredCheckpointState = (
  artifacts: GenerationArtifact[],
  toolKey: SupportedTool,
  sourceArtifact: GenerationArtifact | null,
): ToolPageProgressState => {
  if (!sourceArtifact || !belongsToTool(sourceArtifact, toolKey)) {
    return {
      completedSteps: new Set<ToolStep>(),
      latestArtifactByStep: {},
      lastCheckpointStep: null,
    };
  }

  const artifactById = new Map(artifacts.map((artifact) => [artifact.artifactId, artifact]));
  const latestArtifactByStep = readStepDependencyArtifactIdsByStep(sourceArtifact);
  const restoredArtifactByStep = Object.entries(latestArtifactByStep).reduce<Partial<Record<ToolStep, GenerationArtifact>>>((acc, [step, artifactId]) => {
    const artifact = artifactById.get(artifactId);
    if (
      artifact
      && artifact.projectId === sourceArtifact.projectId
      && belongsToTool(artifact, toolKey)
    ) {
      acc[step as ToolStep] = artifact;
    }
    return acc;
  }, {});

  const sourceStep = readArtifactStep(sourceArtifact);
  if (sourceStep && sourceArtifact.status === 'completed') {
    restoredArtifactByStep[sourceStep] = sourceArtifact;
  }

  const completedSteps = new Set(
    Object.entries(restoredArtifactByStep)
      .filter(([, artifact]) => artifact?.status === 'completed')
      .map(([step]) => step as ToolStep),
  );

  const lastCheckpointStep = toolStepOrder[toolKey].filter((step) => completedSteps.has(step)).at(-1) ?? null;

  return {
    completedSteps,
    latestArtifactByStep: restoredArtifactByStep,
    lastCheckpointStep,
  };
};

const buildLatestRunArtifactByStep = (
  artifacts: GenerationArtifact[],
  toolKey: SupportedTool,
  projectId: string,
  runRequestPrefix: string,
): Partial<Record<ToolStep, GenerationArtifact>> => {
  const normalizedProjectId = projectId.trim();
  const normalizedRunRequestPrefix = runRequestPrefix.trim();
  if (!normalizedProjectId || !normalizedRunRequestPrefix) {
    return {};
  }

  const sorted = [...artifacts]
    .filter((artifact) => (
      artifact.projectId === normalizedProjectId
      && artifact.status === 'completed'
      && typeof artifact.requestId === 'string'
      && artifact.requestId.startsWith(`${normalizedRunRequestPrefix}:`)
      && belongsToTool(artifact, toolKey)
    ))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return sorted.reduce<Partial<Record<ToolStep, GenerationArtifact>>>((acc, artifact) => {
    const step = artifact.sourceRequest.input?.step;
    if (typeof step !== 'string') {
      return acc;
    }

    if (!acc[step as ToolStep]) {
      acc[step as ToolStep] = artifact;
    }

    return acc;
  }, {});
};

export const resolveFlowProgressState = (
  artifacts: GenerationArtifact[],
  toolKey: SupportedTool,
  projectId: string,
  intent: 'new' | 'resume' | 'regenerate',
  sourceArtifact: GenerationArtifact | null,
  runRequestPrefix: string | null,
): ToolPageProgressState => {
  const historicalCompletedSteps = collectCompletedStepsByTool(artifacts, toolKey, projectId);
  const historicalLatestArtifactByStep = buildLatestArtifactByStep(artifacts, toolKey, projectId);
  const restoredCheckpointState = resolveRestoredCheckpointState(artifacts, toolKey, sourceArtifact);
  const hasRestoredCheckout = restoredCheckpointState.completedSteps.size > 0;

  if (!runRequestPrefix) {
    // Relaunch "new" from artifact should behave like a fresh run with prefilled briefing context.
    if (intent === 'new' && sourceArtifact) {
      return {
        completedSteps: new Set<ToolStep>(),
        latestArtifactByStep: {},
        lastCheckpointStep: null,
      };
    }

    if ((intent === 'resume' || intent === 'regenerate') && hasRestoredCheckout) {
      return restoredCheckpointState;
    }

    return {
      completedSteps: historicalCompletedSteps,
      latestArtifactByStep: historicalLatestArtifactByStep,
      lastCheckpointStep: intent === 'resume'
        ? toolStepOrder[toolKey].filter((step) => historicalCompletedSteps.has(step)).at(-1) ?? null
        : null,
    };
  }

  const runCompletedSteps = collectCompletedRunSteps(artifacts, toolKey, projectId, runRequestPrefix);
  const runLatestArtifactByStep = buildLatestRunArtifactByStep(artifacts, toolKey, projectId, runRequestPrefix);

  if (intent === 'regenerate') {
    return {
      completedSteps: runCompletedSteps,
      latestArtifactByStep: runLatestArtifactByStep,
      lastCheckpointStep: null,
    };
  }

  if (intent === 'resume') {
    const baseCompletedSteps = hasRestoredCheckout ? restoredCheckpointState.completedSteps : historicalCompletedSteps;
    return {
      completedSteps: new Set([...baseCompletedSteps, ...runCompletedSteps]),
      latestArtifactByStep: {
        ...(hasRestoredCheckout ? restoredCheckpointState.latestArtifactByStep : historicalLatestArtifactByStep),
        ...runLatestArtifactByStep,
      },
      lastCheckpointStep: hasRestoredCheckout
        ? restoredCheckpointState.lastCheckpointStep
        : toolStepOrder[toolKey].filter((step) => historicalCompletedSteps.has(step)).at(-1) ?? null,
    };
  }

  return {
    completedSteps: historicalCompletedSteps,
    latestArtifactByStep: historicalLatestArtifactByStep,
    lastCheckpointStep: null,
  };
};

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
  progress: ToolPageProgressState;
  readiness: ToolPageReadinessSnapshot;
  pendingStepStart: { step: ToolStep; runRequestPrefix: string } | null;
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
  | { type: 'REQUEST_STEP_START'; step: ToolStep; runRequestPrefix: string }
  | { type: 'STEP_REQUEST_DISPATCHED' }
  | { type: 'START_GENERATION' }
  | { type: 'CANCEL_GENERATION' }
  | { type: 'STEP_DONE'; step: ToolStep }
  | { type: 'STEP_FAILED'; step: ToolStep; message: string }
  | { type: 'RETRY_STEP' }
  | {
    type: 'PROGRESS_SYNCED';
    artifacts: GenerationArtifact[];
    intent: 'new' | 'resume' | 'regenerate';
    sourceArtifact: GenerationArtifact | null;
    runRequestPrefix: string | null;
    hasExtractionContext: boolean;
    hasPrimaryTargetStep: boolean;
  }
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
      return context.readiness.canStartFlow;
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
      readiness: ({ event, context }) => buildReadinessSnapshot(
        event.type === 'PROJECT_SELECTED' ? event.projectId : context.projectId,
        false,
        false,
      ),
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
    syncProgress: assign({
      progress: ({ context, event }) => {
        if (event.type !== 'PROGRESS_SYNCED') {
          return context.progress;
        }

        return resolveFlowProgressState(
          event.artifacts,
          context.toolKey,
          context.projectId,
          event.intent,
          event.sourceArtifact,
          event.runRequestPrefix,
        );
      },
      readiness: ({ context, event }) => {
        if (event.type !== 'PROGRESS_SYNCED') {
          return context.readiness;
        }

        return buildReadinessSnapshot(
          context.projectId,
          event.hasExtractionContext,
          event.hasPrimaryTargetStep,
        );
      },
    }),
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
    }),
    resetConfig: assign(({ context }) => ({
      ...context,
      generationError: null,
      stepArtifactIds: {},
      briefingActorRef: null,
      progress: {
        completedSteps: new Set<ToolStep>(),
        latestArtifactByStep: {},
        lastCheckpointStep: null,
      },
      readiness: buildReadinessSnapshot(context.projectId, false, false),
      pendingStepStart: null,
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
    progress: {
      completedSteps: new Set<ToolStep>(),
      latestArtifactByStep: {},
      lastCheckpointStep: null,
    },
    readiness: buildReadinessSnapshot(input.projectId, false, false),
    pendingStepStart: null,
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
        STEP_REQUEST_DISPATCHED: {
          actions: 'clearPendingStepStart',
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
