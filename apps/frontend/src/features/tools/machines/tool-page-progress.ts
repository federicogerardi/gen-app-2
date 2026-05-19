import { toolStepOrder } from '../runtime/tool-generation-engine';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import {
  belongsToTool,
  buildLatestArtifactByStep,
  collectCompletedRunSteps,
  collectCompletedStepsByTool,
  extractArtifactStep,
} from '../../generation/runtime/step-hydration';
import type { SupportedTool, ToolStep } from './tool-flow.machine';

export type ToolPageProgressState = {
  completedSteps: Set<ToolStep>;
  latestArtifactByStep: Partial<Record<ToolStep, GenerationArtifact>>;
  lastCheckpointStep: ToolStep | null;
};

export const readStepDependencyArtifactIdsByStep = (
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

export const buildLatestRunArtifactByStep = (
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
  // context.sessionId is a frontend-generated UUID for the current machine session.
  // Historical artifacts from previous sessions carry a different sessionId, so we must
  // NOT filter historicalCompletedSteps by it - use tool-scoped collection instead.
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
