import { assign, fromPromise, raise, sendTo, setup, stopChild, type ActorRefFrom } from 'xstate';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { briefingUploadMachine } from './briefing-upload.machine';
import { toolFlowMachine, type SupportedTool, type ToolStep } from './tool-flow.machine';
import { toolStepOrder } from '../runtime/tool-generation-engine';
import type {
  CanonicalToolUiState,
  PrimaryActionPolicy,
  SecondaryActionFlags,
} from '../runtime/tool-ux-state';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import {
  belongsToTool,
  buildExtractionContextFromArtifact,
  buildLatestArtifactByStep,
  collectCompletedRunSteps,
  collectCompletedStepsByTool,
} from '../../generation/runtime/step-hydration';
import { getArtifactById, listArtifacts } from '../../artifacts/runtime/artifacts-client';

export type HydrationResult = {
  extractionArtifactId: string;
  extractionPayload: Record<string, unknown>;
  briefingId: string;
  briefingFileName: string | null;
  normalizedText: string;
  parsedFormat: 'txt' | 'md' | 'docx';
};

type PendingHydration = {
  sourceArtifactId: string | null;
  intent: 'new' | 'resume' | 'regenerate';
  resolvedBriefingId: string | null;
  sourceExtractionArtifactId: string | null;
  localArtifacts: GenerationArtifact[];
};

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

export type ToolPageViewModel = {
  readiness: ToolPageReadinessSnapshot;
  canonicalState: CanonicalToolUiState;
  primaryActionPolicy: PrimaryActionPolicy;
  secondaryActionFlags: SecondaryActionFlags;
  stepStatuses: Record<ToolStep, 'idle' | 'running' | 'completed' | 'error'>;
  messages: {
    status: string | null;
    error: string | null;
  };
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

const buildDefaultStepStatuses = (
  toolKey: SupportedTool,
): Record<ToolStep, 'idle' | 'running' | 'completed' | 'error'> => {
  const entries = toolStepOrder[toolKey].map((step) => [step, 'idle'] as const);
  return Object.fromEntries(entries) as Record<ToolStep, 'idle' | 'running' | 'completed' | 'error'>;
};

const buildDefaultViewModel = (
  toolKey: SupportedTool,
  readiness: ToolPageReadinessSnapshot,
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
      ? 'Pronto per la generazione'
      : 'Seleziona un progetto e carica un brief per iniziare',
    error: null,
  },
});

type BuildToolPageViewModelInput = {
  toolKey: SupportedTool;
  intent?: 'new' | 'resume' | 'regenerate';
  readiness: ToolPageReadinessSnapshot;
  progress: ToolPageProgressState;
  generationError: string | null;
  hydrationError?: string | null;
};

const buildToolPageViewModel = ({
  toolKey,
  intent = 'new',
  readiness,
  progress,
  generationError,
  hydrationError,
}: BuildToolPageViewModelInput): ToolPageViewModel => {
  const defaultModel = buildDefaultViewModel(toolKey, readiness);
  const totalSteps = toolStepOrder[toolKey].length;
  const completedCount = progress.completedSteps.size;
  const hasCompletedAtLeastOneStep = completedCount > 0;
  const hasCompletedAllSteps = completedCount === totalSteps && totalSteps > 0;
  const hasCheckpoint = progress.lastCheckpointStep !== null;
  const stepStatuses = buildDefaultStepStatuses(toolKey);

  for (const step of progress.completedSteps) {
    stepStatuses[step] = 'completed';
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

  if (intent === 'regenerate' && hasCompletedAtLeastOneStep && readiness.canStartFlow) {
    return {
      ...defaultModel,
      canonicalState: 'prefilled-regenerate',
      primaryActionPolicy: 'regenerate-current-step',
      secondaryActionFlags: {
        ...defaultModel.secondaryActionFlags,
        canOpenPreviousArtifact: true,
      },
      stepStatuses,
      messages: {
        status: 'Pronto per rigenerare con i nuovi parametri',
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
  briefingActorRef: ActorRefFrom<typeof briefingUploadMachine> | null,
  hydrationResult: HydrationResult | null,
): boolean => {
  if (hydrationResult !== null) {
    return true;
  }
  return briefingActorRef?.getSnapshot().matches('ready') === true;
};

const deriveHasPrimaryTargetStep = (toolKey: SupportedTool): boolean => {
  return toolStepOrder[toolKey].length > 0;
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
  viewModel: ToolPageViewModel;
  pendingStepStart: { step: ToolStep; runRequestPrefix: string } | null;
  hydrationResult: HydrationResult | null;
  hydrationError: string | null;
  pendingHydration: PendingHydration | null;
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
  | { type: 'RESET' }
  | { type: 'INTERNAL_CANCELLED' }
  | {
    type: 'PROGRESS_SYNCED';
    artifacts: GenerationArtifact[];
    intent: 'new' | 'resume' | 'regenerate';
    sourceArtifact: GenerationArtifact | null;
    runRequestPrefix: string | null;
    /** @deprecated Derivato internamente dalla macchina (Phase 3). Sarà rimosso in uno sprint successivo. */
    hasExtractionContext?: boolean;
    /** @deprecated Derivato internamente dalla macchina (Phase 3). Sarà rimosso in uno sprint successivo. */
    hasPrimaryTargetStep?: boolean;
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
    hydrateExtractionContextActor: fromPromise(async ({ input }: {
      input: {
        sourceArtifactId: string | null;
        projectId: string;
        intent: 'new' | 'resume' | 'regenerate';
        resolvedBriefingId: string | null;
        sourceExtractionArtifactId: string | null;
        apiBaseUrl: string;
        capabilities: Partial<BackendCapabilities>;
        localArtifacts: GenerationArtifact[];
      };
    }): Promise<HydrationResult> => {
      const {
        sourceArtifactId,
        projectId,
        resolvedBriefingId,
        sourceExtractionArtifactId,
        apiBaseUrl,
        capabilities,
        localArtifacts,
      } = input;

      // Step 1: risolvi direttamente da sourceArtifactId se disponibile
      if (sourceArtifactId) {
        try {
          const artifact = await getArtifactById(sourceArtifactId, { apiBaseUrl, capabilities, localArtifacts });
          if (artifact) {
            const ctx = buildExtractionContextFromArtifact(artifact);
            if (ctx) {
              return {
                extractionArtifactId: ctx.extractionArtifactId,
                extractionPayload: ctx.extractionPayload,
                briefingId: ctx.briefingId,
                briefingFileName: null,
                normalizedText: ctx.normalizedText,
                parsedFormat: ctx.parsedFormat,
              };
            }
          }
        } catch {
          // fallback a list-based recovery
        }
      }

      // Step 2: lista artifact extraction e ranking (TASK-006)
      const normalizedProjectId = projectId.trim();
      if (!normalizedProjectId) {
        throw new Error('missing_project');
      }

      const artifacts = await listArtifacts(
        { type: 'extraction', status: 'completed', projectId: normalizedProjectId },
        { apiBaseUrl, capabilities, localArtifacts },
      );

      // Ranking: (1) exact sourceExtractionArtifactId match, (2) briefingId match, (3) recency
      const ranked = [...artifacts].sort((a, b) => {
        const aIsSource = sourceExtractionArtifactId != null && a.artifactId === sourceExtractionArtifactId ? 1 : 0;
        const bIsSource = sourceExtractionArtifactId != null && b.artifactId === sourceExtractionArtifactId ? 1 : 0;
        if (aIsSource !== bIsSource) {
          return bIsSource - aIsSource;
        }

        const aBriefingId = typeof a.sourceRequest.input?.briefingId === 'string' ? a.sourceRequest.input.briefingId : null;
        const bBriefingId = typeof b.sourceRequest.input?.briefingId === 'string' ? b.sourceRequest.input.briefingId : null;
        const aMatchesBriefing = resolvedBriefingId != null && aBriefingId === resolvedBriefingId ? 1 : 0;
        const bMatchesBriefing = resolvedBriefingId != null && bBriefingId === resolvedBriefingId ? 1 : 0;
        if (aMatchesBriefing !== bMatchesBriefing) {
          return bMatchesBriefing - aMatchesBriefing;
        }

        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      });

      const best = ranked[0] ?? null;
      if (!best) {
        throw new Error('no_extraction_artifact');
      }

      // TASK-007: buildExtractionContextFromArtifact usa artifactId come fallback briefingId per artifact legacy
      const ctx = buildExtractionContextFromArtifact(best);
      if (!ctx) {
        throw new Error('hydration_context_unresolvable');
      }

      return {
        extractionArtifactId: ctx.extractionArtifactId,
        extractionPayload: ctx.extractionPayload,
        briefingId: ctx.briefingId,
        briefingFileName: null,
        normalizedText: ctx.normalizedText,
        parsedFormat: ctx.parsedFormat,
      };
    }),
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
        event.intent,
        event.sourceArtifact,
        event.runRequestPrefix,
      );

      // Phase 3: readiness derivata interamente da context macchina, non da input UI.
      const hasExtractionContext = deriveHasExtractionContext(context.briefingActorRef, context.hydrationResult);
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
              resolvedBriefingId: event.resolvedBriefingId ?? null,
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
        id: 'hydrateActor',
        src: 'hydrateExtractionContextActor',
        input: ({ context }) => ({
          sourceArtifactId: context.pendingHydration?.sourceArtifactId ?? null,
          projectId: context.projectId,
          intent: context.pendingHydration?.intent ?? 'new',
          resolvedBriefingId: context.pendingHydration?.resolvedBriefingId ?? null,
          sourceExtractionArtifactId: context.pendingHydration?.sourceExtractionArtifactId ?? null,
          apiBaseUrl: context.apiBaseUrl,
          capabilities: context.capabilities,
          localArtifacts: context.pendingHydration?.localArtifacts ?? [],
        }),
        onDone: {
          target: 'configuring',
          actions: [
            assign(({ context, event }) => {
              const hydrationResult = event.output as HydrationResult;
              const intent = context.pendingHydration?.intent ?? 'new';
              // Ricalcola readiness immediatamente: hydrationResult è ora non-null.
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
              const result = event.output as HydrationResult;
              return {
                type: 'EXTRACTION_RECOVERED' as const,
                artifactId: result.extractionArtifactId,
                payload: result.extractionPayload,
                briefingId: result.briefingId,
                ...(result.briefingFileName != null && { fileName: result.briefingFileName }),
              };
            }),
          ],
        },
        onError: {
          target: 'configuring',
          actions: assign(({ context, event }) => {
            const reason = event.error instanceof Error ? event.error.message : 'hydration_failed';
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
      },
      on: {
        HYDRATE_REQUESTED: {
          target: 'hydrating',
          reenter: true,
          actions: assign(({ event }) => ({
            pendingHydration: {
              sourceArtifactId: event.sourceArtifactId ?? null,
              intent: event.intent,
              resolvedBriefingId: event.resolvedBriefingId ?? null,
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
