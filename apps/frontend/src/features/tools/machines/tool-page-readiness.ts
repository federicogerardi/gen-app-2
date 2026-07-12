import type { ActorRefFrom } from 'xstate';
import { hasReadyBriefingExtractionContext, briefingUploadMachine } from './briefing-upload.machine';
import { isExtractionContextValidForTool } from './extraction-context-validity';
import type { HydrationResult } from './hydration.machine';
import { toolStepOrder } from '../runtime/tool-generation-engine';
import { getRequiredToolInputFiles } from '../runtime/tool-form-architecture';
import type { SupportedTool } from './tool-flow.machine';

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

/**
 * Sprint 4 Session 2 (Phase 1 Step 6, Race A): structural equality check for
 * ReadinessSnapshot. Used by `buildSyncProgressState` to decide whether the
 * readiness part of a PROGRESS_SYNCED assign can be no-op'd alongside the
 * progress part. Equality is: equal 4 booleans + equal reasonCodes set
 * (order-insensitive membership, since reasonCodes is deduplicated upstream).
 */
export const readinessSnapshotsEqual = (
  a: ReadinessSnapshot,
  b: ReadinessSnapshot,
): boolean => {
  if (
    a.canStartFlow !== b.canStartFlow
    || a.hasProject !== b.hasProject
    || a.hasExtractionContext !== b.hasExtractionContext
    || a.hasPrimaryTargetStep !== b.hasPrimaryTargetStep
  ) return false;
  if (a.reasonCodes.length !== b.reasonCodes.length) return false;
  const bSet = new Set(b.reasonCodes);
  for (const code of a.reasonCodes) {
    if (!bSet.has(code)) return false;
  }
  return true;
};

const READINESS_LOGGING_OVERRIDE_KEY = '__TOOL_PAGE_READINESS_LOGGING_ENABLED__';

export const buildReadinessSnapshot = (
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

export const shouldLogInvalidExtractionContext = (): boolean => {
  const override = (globalThis as Record<string, unknown>)[READINESS_LOGGING_OVERRIDE_KEY];
  if (typeof override === 'boolean') {
    return override;
  }

  return import.meta.env.DEV;
};

export const deriveHasExtractionContext = (
  toolKey: SupportedTool,
  briefingActorRef: ActorRefFrom<typeof briefingUploadMachine> | null,
  hydrationResult: HydrationResult | null,
): boolean => {
  // Direct-input-only tools do not require BriefingUpload/ExtractionContext.
  if (getRequiredToolInputFiles(toolKey).length === 0) {
    return true;
  }

  const logInvalidExtractionContext = (
    message: string,
    details: {
      extractionArtifactId: string | null;
      briefingId: string | null;
      normalizedTextLength: number;
      extractionPayloadKeys: number;
    },
  ): void => {
    if (!shouldLogInvalidExtractionContext()) {
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

export const deriveHasPrimaryTargetStep = (toolKey: SupportedTool): boolean => {
  return toolStepOrder[toolKey].length > 0;
};
