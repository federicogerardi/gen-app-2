import { resolveToolWorkflowType } from '@gen-app-2/contracts';
import type {
  GenerationProjectWorkspaceValue,
  GenerationStreamWorkspaceValue,
} from '../../generation/runtime/GenerationWorkspaceProvider';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { readExtractionPayloadFromArtifact } from '../../generation/runtime/step-hydration';
import type {
  HydrationResult,
  ToolPageViewModel,
} from '../machines/tool-page.machine';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';
import { isExtractionContextValidForTool } from '../machines/extraction-context-validity';
import { mapExtractionFieldKeysToLabels } from './extraction-field-matrix';
import {
  toolFileInstructionsRegistry,
  type ToolFileInstructionsConfig,
  type ToolFormConfig,
  type ToolFormState,
} from './tool-form-architecture';
import {
  isEmptyPayload,
  mapInlineDispatchError,
  normalizeModelForPayload,
  normalizeToneProfile,
} from './tool-page-runtime-utils';

type RuntimeIntent = 'new' | 'resume' | 'regenerate';

type LastRequest = GenerationStreamWorkspaceValue['snapshot']['context']['lastRequest'];

type BriefingSnapshot = {
  context: {
    error: string | null;
    extractionArtifactId: string | null;
    extractionPayload: Record<string, unknown> | null;
    briefingId: string | null;
    normalizedText: string | null;
  };
};

export type SelectedExtractionInfo = {
  extractionArtifactId: string;
  extractionPayload: Record<string, unknown>;
  briefingId: string;
  briefingText: string;
};

type TerminalResolution =
  | { status: 'done'; step: ToolStep }
  | { status: 'failed'; step: ToolStep | null; message: string }
  | { status: 'inferred'; step: ToolStep }
  | { status: 'none' };

const validateToolStepCandidate = (
  candidate: unknown,
  toolSteps: readonly ToolStep[],
): ToolStep | null => {
  if (typeof candidate !== 'string') {
    return null;
  }

  return toolSteps.includes(candidate as ToolStep) ? (candidate as ToolStep) : null;
};

const readRequestedStep = (
  lastRequest: LastRequest,
  toolSteps: readonly ToolStep[],
): ToolStep | null => validateToolStepCandidate(lastRequest?.input?.step, toolSteps);

export const selectStreamingStep = ({
  isStreamActive,
  lastRequest,
  toolSteps,
}: {
  isStreamActive: boolean;
  lastRequest: LastRequest;
  toolSteps: readonly ToolStep[];
}): ToolStep | null => {
  if (!isStreamActive) {
    return null;
  }

  return readRequestedStep(lastRequest, toolSteps);
};

export const selectPrimaryTargetStep = ({
  primaryActionPolicy,
  pausedCheckpointStep,
  sourceStep,
  nextAvailableStep,
}: {
  primaryActionPolicy: ToolPageViewModel['primaryActionPolicy'];
  pausedCheckpointStep: ToolStep | null;
  sourceStep: ToolStep | null;
  nextAvailableStep: ToolStep | null;
}): ToolStep | null => {
  if (primaryActionPolicy === 'resume-checkpoint' && pausedCheckpointStep) {
    return pausedCheckpointStep;
  }

  if (primaryActionPolicy === 'regenerate-current-step') {
    return sourceStep ?? nextAvailableStep;
  }

  if (
    primaryActionPolicy === 'start-generation'
    || primaryActionPolicy === 'resume-checkpoint'
  ) {
    return nextAvailableStep;
  }

  return null;
};

export const resolveToolPageRuntimeIntent = ({
  primaryActionPolicy,
  intent,
  sourceArtifactId,
  sourceArtifact,
  machineHydrationResult,
}: {
  primaryActionPolicy: ToolPageViewModel['primaryActionPolicy'];
  intent: RuntimeIntent;
  sourceArtifactId: string | null | undefined;
  sourceArtifact: GenerationArtifact | null;
  machineHydrationResult: HydrationResult | null;
}): RuntimeIntent => {
  if (primaryActionPolicy === 'resume-checkpoint' || intent === 'resume') {
    return 'resume';
  }

  if (primaryActionPolicy === 'regenerate-current-step' || intent === 'regenerate') {
    return 'regenerate';
  }

  const hasArtifactDrivenEntry =
    (sourceArtifactId?.trim().length ?? 0) > 0
    || sourceArtifact !== null
    || machineHydrationResult !== null;

  return hasArtifactDrivenEntry ? 'regenerate' : 'new';
};

export const selectGenerationExtractionInfo = ({
  machineHydrationResult,
  workspaceExtractionContext,
  briefingSnapshot,
  toolKey,
  hasSourceArtifact,
}: {
  machineHydrationResult: HydrationResult | null;
  workspaceExtractionContext: GenerationProjectWorkspaceValue['extractionByProject'][string] | null;
  briefingSnapshot: BriefingSnapshot;
  toolKey: SupportedTool;
  hasSourceArtifact: boolean;
}): SelectedExtractionInfo | null => {
  const briefingContextText = briefingSnapshot.context.normalizedText ?? '';
  if (machineHydrationResult !== null) {
    return {
      extractionArtifactId: machineHydrationResult.extractionArtifactId,
      extractionPayload: machineHydrationResult.extractionPayload,
      briefingId: machineHydrationResult.briefingId,
      briefingText:
        machineHydrationResult.normalizedText.trim().length > 0
          ? machineHydrationResult.normalizedText
          : briefingContextText,
    };
  }

  if (
    workspaceExtractionContext !== null
    && briefingSnapshot.context.error !== 'extraction_context_insufficient'
    && isExtractionContextValidForTool(
      toolKey,
      workspaceExtractionContext.extractionPayload,
      workspaceExtractionContext.normalizedText,
    )
  ) {
    return {
      extractionArtifactId: workspaceExtractionContext.extractionArtifactId,
      extractionPayload: workspaceExtractionContext.extractionPayload,
      briefingId: workspaceExtractionContext.briefingId,
      briefingText: workspaceExtractionContext.normalizedText,
    };
  }

  if (hasSourceArtifact) {
    return null;
  }

  if (
    briefingSnapshot.context.extractionArtifactId
    && briefingSnapshot.context.briefingId
  ) {
    return {
      extractionArtifactId: briefingSnapshot.context.extractionArtifactId,
      extractionPayload: briefingSnapshot.context.extractionPayload ?? {},
      briefingId: briefingSnapshot.context.briefingId,
      briefingText: briefingSnapshot.context.normalizedText ?? '',
    };
  }

  return null;
};

export const needsResolvedExtractionArtifact = ({
  extractionArtifactId,
  extractionPayload,
  briefingText,
  briefingId,
}: SelectedExtractionInfo): boolean => (
  extractionArtifactId.trim().length > 0
  && (
    isEmptyPayload(extractionPayload)
    || briefingText.trim().length === 0
    || briefingId.trim().length === 0
  )
);

export const mergeResolvedExtractionArtifact = ({
  extractionInfo,
  extractionArtifact,
}: {
  extractionInfo: SelectedExtractionInfo;
  extractionArtifact: GenerationArtifact;
}): SelectedExtractionInfo => ({
  extractionArtifactId: extractionInfo.extractionArtifactId,
  extractionPayload: isEmptyPayload(extractionInfo.extractionPayload)
    ? readExtractionPayloadFromArtifact(extractionArtifact)
    : extractionInfo.extractionPayload,
  briefingText:
    extractionInfo.briefingText.trim().length > 0
      ? extractionInfo.briefingText
      : typeof extractionArtifact.sourceRequest.input?.briefingText === 'string'
        ? extractionArtifact.sourceRequest.input.briefingText
        : '',
  briefingId:
    extractionInfo.briefingId
    || (typeof extractionArtifact.sourceRequest.input?.briefingId === 'string'
      ? extractionArtifact.sourceRequest.input.briefingId
      : ''),
});

export const buildBaseGenerationRequest = ({
  userId,
  projectId,
  sessionId,
  toolKey,
  runtimeIntent,
  formState,
  toolConfig,
  resolvedNotes,
  resolvedRelaunchSource,
  sourceArtifactId,
  resolvedBriefingId,
  effectiveBriefingFileName,
  extractionInfo,
  runPrefix,
}: {
  userId: string;
  projectId: string;
  sessionId: string;
  toolKey: SupportedTool;
  runtimeIntent: RuntimeIntent;
  formState: Pick<ToolFormState, 'model' | 'tone' | 'registrySnapshotRef'>;
  toolConfig: Pick<ToolFormConfig, 'defaultModel'>;
  resolvedNotes: string;
  resolvedRelaunchSource: string | null;
  sourceArtifactId: string | null | undefined;
  resolvedBriefingId: string | null;
  effectiveBriefingFileName: string | null | undefined;
  extractionInfo: SelectedExtractionInfo;
  runPrefix: string;
}): GenerationRequest => ({
  requestId: runPrefix,
  userId,
  projectId,
  sessionId,
  artifactType: 'content',
  model: normalizeModelForPayload(formState.model, toolConfig.defaultModel),
  outputFormat: 'markdown',
  toolKey,
  workflowType: resolveToolWorkflowType(toolKey),
  registrySnapshotRef: formState.registrySnapshotRef,
  input: {
    intent: runtimeIntent,
    tone: normalizeToneProfile(formState.tone),
    notes: resolvedNotes,
    relaunchFromArtifactId: resolvedRelaunchSource,
    sourceArtifactId: sourceArtifactId ?? null,
    briefingId: resolvedBriefingId ?? extractionInfo.briefingId,
    briefingText: extractionInfo.briefingText,
    briefingFileName: effectiveBriefingFileName ?? null,
    extractionArtifactId: extractionInfo.extractionArtifactId,
    extractionPayload: extractionInfo.extractionPayload,
  },
});

export const buildDependencyArtifactContentsByStep = (
  dependencies: Record<string, string>,
  artifacts: readonly GenerationArtifact[],
): Record<string, string> => Object.fromEntries(
  Object.entries(dependencies)
    .map(([stepKey, artifactId]): [string, string] => {
      const dependencyArtifact = artifacts.find((artifact) => artifact.artifactId === artifactId);
      return [stepKey, dependencyArtifact?.content ?? ''];
    })
    .filter(([, content]) => content.trim().length > 0),
);

export const selectStreamTerminalResolution = ({
  streamStatus,
  completedStep,
  failedStep,
  lastRequest,
  errorMessage,
  toolSteps,
}: {
  streamStatus: GenerationStreamWorkspaceValue['streamStatus'];
  completedStep: string | null;
  failedStep: string | null;
  lastRequest: LastRequest;
  errorMessage: string | null | undefined;
  toolSteps: readonly ToolStep[];
}): TerminalResolution => {
  const inferredStep = readRequestedStep(lastRequest, toolSteps);
  const normalizedCompletedStep = validateToolStepCandidate(completedStep, toolSteps);

  if (normalizedCompletedStep) {
    return { status: 'done', step: normalizedCompletedStep };
  }

  if (streamStatus === 'failed') {
    return {
      status: 'failed',
      step: validateToolStepCandidate(failedStep, toolSteps) ?? inferredStep,
      message:
        mapInlineDispatchError(errorMessage?.trim() || 'generation_failed')
        ?? 'Generazione fallita',
    };
  }

  if (!completedStep && !failedStep && streamStatus === 'completed' && inferredStep) {
    return { status: 'inferred', step: inferredStep };
  }

  return { status: 'none' };
};

export const selectInterruptedStep = (
  currentRunningStep: ToolStep | null,
  lastRequestedStep: ToolStep | null,
): ToolStep | null => currentRunningStep ?? lastRequestedStep;

export const selectToolFileInstructions = (
  toolKey: SupportedTool,
): ToolFileInstructionsConfig | null => {
  const instructions = toolFileInstructionsRegistry[toolKey];
  if (!instructions) {
    return null;
  }

  return {
    ...instructions,
    requiredFields:
      instructions.requiredFields
      ?? mapExtractionFieldKeysToLabels(instructions.requiredFieldKeys),
  };
};