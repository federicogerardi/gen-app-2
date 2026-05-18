import { assign, sendTo, setup, stopChild, type ActorRefFrom } from 'xstate';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { briefingUploadMachine, hasReadyBriefingExtractionContext } from './briefing-upload.machine';
import { generationLifecycleMachine, type GenerationLifecycleOutput } from './generation-lifecycle.machine';
import {
  hydrationMachine,
  type HydrationMachineOutput,
  type HydrationResult,
  type PendingHydration,
  toCanonicalBriefingId,
} from './hydration.machine';
import { toolFlowMachine, type SupportedTool, type ToolStep, type ToolStepStatus } from './tool-flow.machine';
import { isExtractionContextValidForTool } from './extraction-context-validity';
import { toolStepOrder } from '../runtime/tool-generation-engine';
import type {
  CanonicalToolUiState,
  PrimaryActionPolicy,
  SecondaryActionFlags,
} from '../runtime/tool-ux-state';
import { generateSessionId } from '../../../app/runtime/shared-utils';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import {
  belongsToTool,
  buildLatestArtifactByStep,
  collectCompletedRunSteps,
  collectCompletedStepsBySession,
  collectCompletedStepsByTool,
  extractArtifactStep,
} from '../../generation/runtime/step-hydration';

export type { HydrationResult } from './hydration.machine';

export type ToolPageProgressState = {
  completedSteps: Set<ToolStep>;
  latestArtifactByStep: Partial<Record<ToolStep, GenerationArtifact>>;
  lastCheckpointStep: ToolStep | null;
};

export type ReadinessReasonCode =
  | 'missing_project'
  | 'missing_extraction_context'
  | 'missing_primary_target_step';

export type ReadinessSnapshot = {
  canStartFlow: boolean;
  hasProject: boolean;
  hasExtractionContext: boolean;
  hasPrimaryTargetStep: boolean;
  reasonCodes: ReadinessReasonCode[];
};

export type ToolPageViewModel = {
  readiness: ReadinessSnapshot;
  canonicalState: CanonicalToolUiState;
  primaryActionPolicy: PrimaryActionPolicy;
  secondaryActionFlags: SecondaryActionFlags;
  stepStatuses: Record<ToolStep, ToolStepStatus>;
  messages: {
    status: string | null;
    error: string | null;
  };
};

const buildReadinessSnapshot = (
  projectId: string,
  hasExtractionContext: boolean,
  hasPrimaryTargetStep: boolean,
): ReadinessSnapshot => {
  const hasProject = projectId.trim().length > 0;
  const reasonCodes: ReadinessReasonCode[] = [];

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

const buildDefaultStepStatuses = (
  toolKey: SupportedTool,
): Record<ToolStep, ToolStepStatus> => {
  const entries = toolStepOrder[toolKey].map((step) => [step, 'idle'] as const);
  return Object.fromEntries(entries) as Record<ToolStep, ToolStepStatus>;
};

const readDoneEventPayload = (event: unknown): unknown => {
  const doneEvent = event as { output?: unknown; data?: unknown; result?: unknown } | undefined;
  return doneEvent?.output ?? doneEvent?.data ?? doneEvent?.result ?? event;
};

const readHydrationMachineOutput = (event: unknown): HydrationMachineOutput => {
  const output = readDoneEventPayload(event);
  if (output && typeof output === 'object' && 'status' in output) {
    return output as HydrationMachineOutput;
  }

  if (
    output
    && typeof output === 'object'
    && 'extractionArtifactId' in output
    && 'briefingId' in output
    && 'normalizedText' in output
  ) {
    return {
      status: 'success',
      hydration: output as HydrationResult,
    };
  }

  return {
    status: 'error',
    reason: 'hydration_failed',
  };
};

const TOOL_PAGE_MESSAGES = {
  readyStatus: 'Pronto per la generazione',
  waitingStatus: 'Seleziona un progetto e carica un brief per iniziare',
} as const;

const buildDefaultViewModel = (
  toolKey: SupportedTool,
  readiness: ReadinessSnapshot,
): ToolPageViewModel => ({
  readiness,
  canonicalState: readiness.canStartFlow ? 'draft-ready' : 'draft-empty',
  primaryActionPolicy: readiness.canStartFlow ? 'start-generation' : 'disabled',
  secondaryActionFlags: {
    canRetry: false,
    canSkipStep: false,
    canCancelGeneration: false,
    canOpenPreviousArtifact: false,
  },
  stepStatuses: buildDefaultStepStatuses(toolKey),
  messages: {
    status: readiness.canStartFlow
      ? TOOL_PAGE_MESSAGES.readyStatus
      : TOOL_PAGE_MESSAGES.waitingStatus,
    error: null,
  },
});

type BuildToolPageViewModelInput = {
  toolKey: SupportedTool;
  intent?: 'new' | 'resume' | 'regenerate';
  readiness: ReadinessSnapshot;
  progress: ToolPageProgressState;
  generationError: string | null;
  hydrationError?: string | null;
  /** Non-null when a run has been started in the current session (set by REQUEST_STEP_START / startGenerationStep). */
  runRequestPrefix?: string | null;
};

const buildToolPageViewModel = ({
  toolKey,
  intent = 'new',
  readiness,
  progress,
  generationError,
  hydrationError,
  runRequestPrefix = null,
}: BuildToolPageViewModelInput): ToolPageViewModel => {
  const defaultModel = buildDefaultViewModel(toolKey, readiness);
  const totalSteps = toolStepOrder[toolKey].length;
  const completedCount = progress.completedSteps.size;
  const hasCompletedAtLeastOneStep = completedCount > 0;
  const hasCompletedAllSteps = completedCount === totalSteps && totalSteps > 0;
  const hasCheckpoint = progress.lastCheckpointStep !== null;
  const stepStatuses = buildDefaultStepStatuses(toolKey);
  // True when the current session run has completed all steps (runRequestPrefix!=null means a run
  // was started this session; completedSteps are then filtered to that run by resolveFlowProgressState).
  const isCurrentRunComplete = runRequestPrefix !== null && hasCompletedAllSteps;

  for (const step of progress.completedSteps) {
    stepStatuses[step] = 'done';
  }

  if (generationError) {
    return {
      ...defaultModel,
      canonicalState: 'paused-with-checkpoint',
      primaryActionPolicy: 'resume-checkpoint',
      secondaryActionFlags: {
        ...defaultModel.secondaryActionFlags,
        canRetry: true,
        canOpenPreviousArtifact: hasCompletedAtLeastOneStep,
      },
      stepStatuses,
      messages: {
        status: 'Generazione in pausa per un errore',
        error: generationError,
      },
    };
  }

  if (intent === 'regenerate' && readiness.canStartFlow && !isCurrentRunComplete) {
    return {
      ...defaultModel,
      canonicalState: 'prefilled-regenerate',
      primaryActionPolicy: 'regenerate-current-step',
      secondaryActionFlags: {
        ...defaultModel.secondaryActionFlags,
        canOpenPreviousArtifact: hasCompletedAtLeastOneStep,
      },
      stepStatuses,
      messages: {
        status: 'Pronto per rigenerare con i nuovi parametri',
        error: null,
      },
    };
  }

  if (hasCompletedAllSteps) {
    return {
      ...defaultModel,
      canonicalState: 'completed',
      primaryActionPolicy: 'open-last-artifact',
      secondaryActionFlags: {
        ...defaultModel.secondaryActionFlags,
        canRetry: true,
        canOpenPreviousArtifact: true,
      },
      stepStatuses,
      messages: {
        status: 'Tutti gli artefatti sono stati generati',
        error: null,
      },
    };
  }

  if (hasCheckpoint && readiness.canStartFlow) {
    return {
      ...defaultModel,
      canonicalState: 'paused-with-checkpoint',
      primaryActionPolicy: 'resume-checkpoint',
      secondaryActionFlags: {
        ...defaultModel.secondaryActionFlags,
        canRetry: true,
        canOpenPreviousArtifact: hasCompletedAtLeastOneStep,
      },
      stepStatuses,
      messages: {
        status: `Puoi riprendere dallo step: ${progress.lastCheckpointStep}`,
        error: null,
      },
    };
  }

  return {
    ...defaultModel,
    secondaryActionFlags: {
      ...defaultModel.secondaryActionFlags,
      canOpenPreviousArtifact: hasCompletedAtLeastOneStep,
    },
    stepStatuses,
    messages: {
      ...defaultModel.messages,
      error: hydrationError ?? null,
    },
  };
};

const canStartFromPolicy = (policy: PrimaryActionPolicy): boolean => {
  return policy === 'start-generation' || policy === 'resume-checkpoint' || policy === 'regenerate-current-step';
};

// Phase 3: readiness derivata interamente da context macchina
const deriveHasExtractionContext = (
  toolKey: SupportedTool,
  briefingActorRef: ActorRefFrom<typeof briefingUploadMachine> | null,
  hydrationResult: HydrationResult | null,
): boolean => {
  const logInvalidExtractionContext = (
    message: string,
    details: {
      extractionArtifactId: string | null;
      briefingId: string | null;
      normalizedTextLength: number;
      extractionPayloadKeys: number;
    },
  ): void => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.warn(message, {
      toolKey,
      ...details,
    });
  };

  if (hydrationResult !== null) {
    const isComplete = hydrationResult.extractionArtifactId.trim().length > 0
      && hydrationResult.briefingId.trim().length > 0
      && hydrationResult.normalizedText.trim().length > 0;

    if (isComplete) {
      const valid = isExtractionContextValidForTool(
        toolKey,
        hydrationResult.extractionPayload,
        hydrationResult.normalizedText,
        { allowEmptyPayload: true },
      );
      if (!valid) {
        logInvalidExtractionContext(
          '[deriveHasExtractionContext] ExtractionContext non valido dopo hydration:',
          {
          extractionArtifactId: hydrationResult.extractionArtifactId,
          briefingId: hydrationResult.briefingId,
          normalizedTextLength: hydrationResult.normalizedText.length,
          extractionPayloadKeys: Object.keys(hydrationResult.extractionPayload ?? {}).length,
          },
        );
      }
      return valid;
    }
  }

  const validBriefing = hasReadyBriefingExtractionContext(toolKey, briefingActorRef);
  if (!validBriefing) {
    const snapshot = briefingActorRef?.getSnapshot();
    logInvalidExtractionContext('[deriveHasExtractionContext] Briefing context non valido:', {
      extractionArtifactId: snapshot?.context.extractionArtifactId ?? null,
      briefingId: snapshot?.context.briefingId ?? null,
      normalizedTextLength: snapshot?.context.normalizedText?.length ?? 0,
      extractionPayloadKeys: Object.keys(snapshot?.context.extractionPayload ?? {}).length,
    });
  }
  return validBriefing;
};

const deriveHasPrimaryTargetStep = (toolKey: SupportedTool): boolean => {
  return toolStepOrder[toolKey].length > 0;
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
  if (!sourceArtifact || sourceArtifact.artifactType === 'extraction' || !belongsToTool(sourceArtifact, toolKey)) {
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

  const sourceStep = extractArtifactStep(sourceArtifact);
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
    const step = extractArtifactStep(artifact);
    if (step === null) {
      return acc;
    }

    if (!acc[step]) {
      acc[step] = artifact;
    }

    return acc;
  }, {});
};

export const resolveFlowProgressState = (
  artifacts: GenerationArtifact[],
  toolKey: SupportedTool,
  projectId: string,
  sessionId: string | null,
  intent: 'new' | 'resume' | 'regenerate',
  sourceArtifact: GenerationArtifact | null,
  runRequestPrefix: string | null,
): ToolPageProgressState => {
  // context.sessionId is a frontend-generated UUID for the *current* machine session.
  // Historical artifacts from previous sessions carry a different sessionId, so we must
  // NOT filter historicalCompletedSteps by it — use tool-scoped collection instead.
  // Session-scoped filtering applies only to artifacts explicitly loaded via the session endpoint.
  void sessionId;
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
  sessionId: string;
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
  readiness: ReadinessSnapshot;
  viewModel: ToolPageViewModel;
  pendingStepStart: { step: ToolStep; runRequestPrefix: string } | null;
  hydrationResult: HydrationResult | null;
  hydrationError: string | null;
  pendingHydration: PendingHydration | null;
};

type ToolPageInput = {
  toolKey: SupportedTool;
  sessionId?: string;
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
  | { type: 'RESET' }
  | {
    type: 'PROGRESS_SYNCED';
    artifacts: GenerationArtifact[];
    intent: 'new' | 'resume' | 'regenerate';
    sourceArtifact: GenerationArtifact | null;
    runRequestPrefix: string | null;
  }
  | {
    type: 'HYDRATE_REQUESTED';
    sourceArtifactId?: string | null;
    intent: 'new' | 'resume' | 'regenerate';
    resolvedBriefingId?: string | null;
    sourceExtractionArtifactId?: string | null;
    localArtifacts?: GenerationArtifact[];
  };

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
      progress: () => ({
        completedSteps: new Set<ToolStep>(),
        latestArtifactByStep: {},
        lastCheckpointStep: null,
      }),
      readiness: ({ event, context }) => buildReadinessSnapshot(
        event.type === 'PROJECT_SELECTED' ? event.projectId : context.projectId,
        false,
        false,
      ),
      viewModel: ({ event, context }) => {
        const projectId = event.type === 'PROJECT_SELECTED' ? event.projectId : context.projectId;
        const readiness = buildReadinessSnapshot(projectId, false, false);
        const progress = {
          completedSteps: new Set<ToolStep>(),
          latestArtifactByStep: {},
          lastCheckpointStep: null,
        };

        return buildToolPageViewModel({
          toolKey: context.toolKey,
          readiness,
          progress,
          generationError: null,
        });
      },
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
    syncProgress: assign(({ context, event }) => {
      if (event.type !== 'PROGRESS_SYNCED') {
        return {};
      }

      const progress = resolveFlowProgressState(
        event.artifacts,
        context.toolKey,
        context.projectId,
        context.sessionId,
        event.intent,
        event.sourceArtifact,
        event.runRequestPrefix,
      );

      // Phase 3: readiness derivata interamente da context macchina, non da input UI.
      const hasExtractionContext = deriveHasExtractionContext(
        context.toolKey,
        context.briefingActorRef,
        context.hydrationResult,
      );
      const hasPrimaryTargetStep = deriveHasPrimaryTargetStep(context.toolKey);
      const readiness = buildReadinessSnapshot(context.projectId, hasExtractionContext, hasPrimaryTargetStep);

      return {
        progress,
        readiness,
        viewModel: buildToolPageViewModel({
          toolKey: context.toolKey,
          intent: event.intent,
          readiness,
          progress,
          generationError: context.generationError,
          runRequestPrefix: event.runRequestPrefix,
        }),
      };
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
      viewModel: ({ context }) => buildToolPageViewModel({
        toolKey: context.toolKey,
        readiness: context.readiness,
        progress: context.progress,
        generationError: 'Tool flow failed',
      }),
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
      // Rebuild deterministic viewModel from reset primitives.
      viewModel: buildToolPageViewModel({
        toolKey: context.toolKey,
        readiness: buildReadinessSnapshot(context.projectId, false, false),
        progress: {
          completedSteps: new Set<ToolStep>(),
          latestArtifactByStep: {},
          lastCheckpointStep: null,
        },
        generationError: null,
      }),
      pendingStepStart: null,
      hydrationResult: null,
      hydrationError: null,
      pendingHydration: null,
    })),
    sendBriefingSelected: sendTo(
      'briefingActor',
      ({ event }) => (event.type === 'BRIEFING_FILE_SELECTED'
        ? { type: 'FILE_SELECTED', file: event.file }
        : { type: 'RESET' }),
    ),
    sendBriefingReset: sendTo('briefingActor', { type: 'RESET' }),
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
        HYDRATE_REQUESTED: {
          target: 'hydrating',
          actions: assign(({ event }) => ({
            pendingHydration: {
              sourceArtifactId: event.sourceArtifactId ?? null,
              intent: event.intent,
              resolvedBriefingId: toCanonicalBriefingId(event.resolvedBriefingId),
              sourceExtractionArtifactId: event.sourceExtractionArtifactId ?? null,
              localArtifacts: event.localArtifacts ?? [],
            },
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
            sourceArtifactId: context.pendingHydration?.sourceArtifactId ?? null,
            intent: context.pendingHydration?.intent ?? 'new',
            resolvedBriefingId: context.pendingHydration?.resolvedBriefingId ?? null,
            sourceExtractionArtifactId: context.pendingHydration?.sourceExtractionArtifactId ?? null,
            localArtifacts: context.pendingHydration?.localArtifacts ?? [],
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
                const intent = context.pendingHydration?.intent ?? 'new';
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
            pendingHydration: {
              sourceArtifactId: event.sourceArtifactId ?? null,
              intent: event.intent,
              resolvedBriefingId: toCanonicalBriefingId(event.resolvedBriefingId),
              sourceExtractionArtifactId: event.sourceExtractionArtifactId ?? null,
              localArtifacts: event.localArtifacts ?? [],
            },
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
          maxRetries: 3,
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
