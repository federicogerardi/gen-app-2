import type { ToolStep } from './tool-flow.machine';
import { buildReadinessSnapshot, deriveHasExtractionContext, deriveHasPrimaryTargetStep, readinessSnapshotsEqual } from './tool-page-readiness';
import { progressStatesEqual, resolveFlowProgressState } from './tool-page-progress';
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
    errorMessage: null,
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

  // Sprint 4 Session 2 (Phase 1 Step 6, Race A): dedup consecutive PROGRESS_SYNCED
  // events. Multiple sources (startGenerationStep, handleCancelGeneration, the
  // useToolPage sync effect) can issue PROGRESS_SYNCED back-to-back with the same
  // artifact array; without this guard the assign would invalidate progress /
  // readiness / intent / runRequestPrefix references and trigger spurious
  // re-renders + bridge re-evaluations under React 19 concurrent rendering.
  // Three outcomes, in order:
  //   (i) progress + intent + runRequestPrefix + readiness all unchanged → no-op.
  //   (ii) progress + intent + runRequestPrefix unchanged but readiness differs
  //        (briefingActorRef / hydrationResult flipped readiness) → mutate only
  //        readiness, keep progress reference stable.
  //   (iii) otherwise → full assign.
  const intentUnchanged = context.intent === event.intent;
  const runRequestPrefixUnchanged = context.runRequestPrefix === event.runRequestPrefix;
  const progressUnchanged = progressStatesEqual(context.progress, progress);

  const hasExtractionContext = deriveHasExtractionContext(
    context.toolKey,
    context.briefingActorRef,
    context.hydrationResult,
  );
  const hasPrimaryTargetStep = deriveHasPrimaryTargetStep(context.toolKey);
  const readiness = buildReadinessSnapshot(context.projectId, hasExtractionContext, hasPrimaryTargetStep);
  const readinessUnchanged = readinessSnapshotsEqual(context.readiness, readiness);

  if (intentUnchanged && runRequestPrefixUnchanged && progressUnchanged && readinessUnchanged) {
    return {};
  }
  if (intentUnchanged && runRequestPrefixUnchanged && progressUnchanged) {
    // Only readiness differs — surgical update so the progress reference stays
    // identity-stable for downstream consumers (e.g. useToolPageStateConsumer).
    return { readiness };
  }

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
    errorMessage: null,
    stepArtifactIds: {},
    briefingActorRef: null,
    progress,
    readiness,
    intent: 'new' as const,
    runRequestPrefix: null,
    pendingStepStart: null,
    hydrationResult: null,
    pendingHydration: null,
  };
};
