import type { ToolStep } from './tool-flow.machine';
import { buildReadinessSnapshot, deriveHasExtractionContext, deriveHasPrimaryTargetStep } from './tool-page-readiness';
import { resolveFlowProgressState } from './tool-page-progress';
import type { ToolPageContext, ToolPageEvent } from './tool-page.types';

export const buildEmptyProgressState = () => ({
  completedSteps: new Set<ToolStep>(),
  latestArtifactByStep: {},
  lastCheckpointStep: null,
});

export const buildSetProjectState = (
  context: ToolPageContext,
  event: ToolPageEvent,
) => {
  const projectId = event.type === 'PROJECT_SELECTED' ? event.projectId : context.projectId;
  const progress = buildEmptyProgressState();
  const readiness = buildReadinessSnapshot(projectId, false, false);

  return {
    projectId,
    generationError: null,
    stepArtifactIds: {},
    briefingActorRef: null,
    progress,
    readiness,
    intent: 'new' as const,
    runRequestPrefix: null,
  };
};

export const buildSyncProgressState = (
  context: ToolPageContext,
  event: ToolPageEvent,
) => {
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
    intent: event.intent,
    runRequestPrefix: event.runRequestPrefix,
  };
};

export const buildResetConfigState = (context: ToolPageContext) => {
  const progress = buildEmptyProgressState();
  const readiness = buildReadinessSnapshot(context.projectId, false, false);

  return {
    ...context,
    generationError: null,
    stepArtifactIds: {},
    briefingActorRef: null,
    progress,
    readiness,
    intent: 'new' as const,
    runRequestPrefix: null,
    pendingStepStart: null,
    hydrationResult: null,
    hydrationError: null,
    pendingHydration: null,
  };
};
