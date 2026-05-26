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
  getToolApiAcquisitionPolicy,
  toolFileInstructionsRegistry,
  type ToolApiAcquisitionPolicyEntry,
  type ToolInputFilePolicyEntry,
  type ToolFileInstructionsConfig,
  type ToolFormConfig,
  type ToolFormState,
  type ToolInputSourceFamily,
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

const splitCommaOrLineList = (value: string): string[] => value
  .split(/[\n,]/g)
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);

export const buildYoutubeDescriptionDirectInputExtractionInfo = ({
  videoTitle,
  topic,
  keywords,
  ctaText,
  ctaLink,
  credentialsOrProof,
  chaptersWithTimestamps,
  socialLinks,
  hashtags,
}: Pick<
  ToolFormState,
  | 'videoTitle'
  | 'topic'
  | 'keywords'
  | 'ctaText'
  | 'ctaLink'
  | 'credentialsOrProof'
  | 'chaptersWithTimestamps'
  | 'socialLinks'
  | 'hashtags'
>): SelectedExtractionInfo | null => {
  const normalizedVideoTitle = videoTitle.trim();
  const normalizedTopic = topic.trim();
  const normalizedCtaText = ctaText.trim();
  const normalizedCtaLink = ctaLink.trim();
  const normalizedCredentials = credentialsOrProof.trim();
  const normalizedKeywords = splitCommaOrLineList(keywords);
  const normalizedChapters = chaptersWithTimestamps
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const normalizedSocialLinks = socialLinks
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const normalizedHashtags = splitCommaOrLineList(hashtags);

  if (
    !normalizedVideoTitle
    || !normalizedTopic
    || normalizedKeywords.length === 0
    || !normalizedCtaText
    || !normalizedCtaLink
    || !normalizedCredentials
    || normalizedChapters.length === 0
    || normalizedSocialLinks.length === 0
    || normalizedHashtags.length === 0
  ) {
    return null;
  }

  return {
    extractionArtifactId: 'direct-input:youtube-description',
    briefingId: 'direct-input:youtube-description',
    briefingText: [
      `Video title: ${normalizedVideoTitle}`,
      `Topic: ${normalizedTopic}`,
      `Keywords: ${normalizedKeywords.join(', ')}`,
      `CTA text: ${normalizedCtaText}`,
      `CTA link: ${normalizedCtaLink}`,
      `Credentials or proof: ${normalizedCredentials}`,
      'Chapters with timestamps:',
      ...normalizedChapters.map((entry) => `- ${entry}`),
      'Social links:',
      ...normalizedSocialLinks.map((entry) => `- ${entry}`),
      `Hashtags: ${normalizedHashtags.join(', ')}`,
    ].join('\n'),
    extractionPayload: {
      videoTitle: normalizedVideoTitle,
      topic: normalizedTopic,
      keywords: normalizedKeywords,
      ctaText: normalizedCtaText,
      ctaLink: normalizedCtaLink,
      credentialsOrProof: normalizedCredentials,
      chaptersWithTimestamps: normalizedChapters,
      socialLinks: normalizedSocialLinks,
      hashtags: normalizedHashtags,
    },
  };
};

type TerminalResolution =
  | { status: 'done'; step: ToolStep }
  | { status: 'failed'; step: ToolStep | null; message: string }
  | { status: 'inferred'; step: ToolStep }
  | { status: 'none' };

export type ToolFileInstructionsViewModel = ToolFileInstructionsConfig & {
  requiredFields: readonly string[];
  alwaysRequiredFiles: readonly ToolInputFilePolicyEntry[];
  requiredBySettingFiles: readonly ToolInputFilePolicyEntry[];
  optionalBySettingFiles: readonly ToolInputFilePolicyEntry[];
};

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
  directInputExtractionInfo = null,
}: {
  machineHydrationResult: HydrationResult | null;
  workspaceExtractionContext: GenerationProjectWorkspaceValue['extractionByProject'][string] | null;
  briefingSnapshot: BriefingSnapshot;
  toolKey: SupportedTool;
  hasSourceArtifact: boolean;
  directInputExtractionInfo?: SelectedExtractionInfo | null;
}): SelectedExtractionInfo | null => {
  if (toolKey === 'youtube-description' && directInputExtractionInfo) {
    return directInputExtractionInfo;
  }

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
  formState: Pick<ToolFormState, 'model' | 'tone' | 'campaignObjective' | 'registrySnapshotRef'>;
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
    extractionPayload: (
      toolKey === 'meta-ads'
      && typeof formState.campaignObjective === 'string'
      && formState.campaignObjective.trim().length > 0
      && !(
        typeof extractionInfo.extractionPayload.campaign_objective === 'string'
        && extractionInfo.extractionPayload.campaign_objective.trim().length > 0
      )
    )
      ? {
        ...extractionInfo.extractionPayload,
        campaign_objective: formState.campaignObjective.trim(),
      }
      : extractionInfo.extractionPayload,
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
): ToolFileInstructionsViewModel | null => {
  const instructions = toolFileInstructionsRegistry[toolKey];
  if (!instructions) {
    return null;
  }

  const alwaysRequiredFiles = instructions.inputFiles.filter((file) => file.requiredness === 'always-required');
  const requiredBySettingFiles = instructions.inputFiles.filter((file) => file.requiredness === 'required-by-tool-setting');
  const optionalBySettingFiles = instructions.inputFiles.filter((file) => file.requiredness === 'optional-by-tool-setting');

  return {
    ...instructions,
    requiredFiles: [...alwaysRequiredFiles, ...requiredBySettingFiles].map((file) => `${file.label} (${file.accept.replace(/,/g, ', ')})`),
    requiredFields:
      instructions.requiredFields
      ?? mapExtractionFieldKeysToLabels(instructions.requiredFieldKeys),
    alwaysRequiredFiles,
    requiredBySettingFiles,
    optionalBySettingFiles,
  };
};

export type ToolInputFileCompletion = {
  requiredFilesComplete: boolean;
  missingRequiredFiles: ToolInputFilePolicyEntry[];
  missingOptionalFiles: ToolInputFilePolicyEntry[];
};

export type ToolInputRequirementMatrixEntry = {
  key: string;
  label: string;
  sourceFamily: ToolInputSourceFamily;
  requiredness: ToolInputFilePolicyEntry['requiredness'];
  satisfied: boolean;
};

export type ToolApiAcquisitionStatus = {
  key: string;
  connected: boolean;
  bindingLabel?: string | null;
};

export type ToolInputRequirementMatrix = {
  entries: ToolInputRequirementMatrixEntry[];
  requiredEntriesSatisfied: boolean;
  missingRequiredEntries: ToolInputRequirementMatrixEntry[];
  missingOptionalEntries: ToolInputRequirementMatrixEntry[];
  missingRequiredFiles: ToolInputFilePolicyEntry[];
  missingOptionalFiles: ToolInputFilePolicyEntry[];
  missingRequiredApiAcquisition: ToolApiAcquisitionPolicyEntry[];
  missingOptionalApiAcquisition: ToolApiAcquisitionPolicyEntry[];
};

export const deriveToolInputRequirementMatrix = ({
  toolKey,
  hasProjectSelected,
  completedFileKeys,
  apiAcquisitionStatus = [],
  includeApiAcquisition = true,
}: {
  toolKey: SupportedTool;
  hasProjectSelected: boolean;
  completedFileKeys: readonly string[];
  apiAcquisitionStatus?: readonly ToolApiAcquisitionStatus[];
  includeApiAcquisition?: boolean;
}): ToolInputRequirementMatrix => {
  const instructions = toolFileInstructionsRegistry[toolKey];
  const completedKeys = new Set(completedFileKeys.filter((key) => key.trim().length > 0));
  const apiStatusByKey = new Map(
    apiAcquisitionStatus.map((status) => [status.key, status.connected]),
  );
  const apiAcquisitionInputs = includeApiAcquisition ? getToolApiAcquisitionPolicy(toolKey) : [];

  const directEntries: ToolInputRequirementMatrixEntry[] = [
    {
      key: 'project-selection',
      label: 'ProjectSelection',
      sourceFamily: 'direct-input',
      requiredness: 'always-required',
      satisfied: hasProjectSelected,
    },
  ];

  const fileEntries: ToolInputRequirementMatrixEntry[] = instructions.inputFiles.map((file) => ({
    key: file.key,
    label: file.label,
    sourceFamily: 'tool-input-file',
    requiredness: file.requiredness,
    satisfied: completedKeys.has(file.key),
  }));

  const apiEntries: ToolInputRequirementMatrixEntry[] = apiAcquisitionInputs.map((apiInput) => ({
    key: apiInput.key,
    label: apiInput.label,
    sourceFamily: 'api-acquisition',
    requiredness: apiInput.requiredness,
    satisfied: apiStatusByKey.get(apiInput.key) ?? false,
  }));

  const entries = [...directEntries, ...fileEntries, ...apiEntries];
  const missingRequiredEntries = entries.filter((entry) => (
    (entry.requiredness === 'always-required' || entry.requiredness === 'required-by-tool-setting')
    && !entry.satisfied
  ));
  const missingOptionalEntries = entries.filter((entry) => (
    entry.requiredness === 'optional-by-tool-setting' && !entry.satisfied
  ));

  const missingRequiredFiles = instructions.inputFiles.filter((file) => (
    (file.requiredness === 'always-required' || file.requiredness === 'required-by-tool-setting')
    && !completedKeys.has(file.key)
  ));

  const missingOptionalFiles = instructions.inputFiles.filter((file) => (
    file.requiredness === 'optional-by-tool-setting'
    && !completedKeys.has(file.key)
  ));

  const missingRequiredApiAcquisition = apiAcquisitionInputs.filter((apiInput) => (
    (apiInput.requiredness === 'always-required' || apiInput.requiredness === 'required-by-tool-setting')
    && !(apiStatusByKey.get(apiInput.key) ?? false)
  ));

  const missingOptionalApiAcquisition = apiAcquisitionInputs.filter((apiInput) => (
    apiInput.requiredness === 'optional-by-tool-setting'
    && !(apiStatusByKey.get(apiInput.key) ?? false)
  ));

  return {
    entries,
    requiredEntriesSatisfied: missingRequiredEntries.length === 0,
    missingRequiredEntries,
    missingOptionalEntries,
    missingRequiredFiles,
    missingOptionalFiles,
    missingRequiredApiAcquisition,
    missingOptionalApiAcquisition,
  };
};

export const deriveToolInputFileCompletion = ({
  toolKey,
  completedFileKeys,
}: {
  toolKey: SupportedTool;
  completedFileKeys: readonly string[];
}): ToolInputFileCompletion => {
  const matrix = deriveToolInputRequirementMatrix({
    toolKey,
    hasProjectSelected: true,
    completedFileKeys,
  });

  return {
    requiredFilesComplete: matrix.missingRequiredFiles.length === 0,
    missingRequiredFiles: matrix.missingRequiredFiles,
    missingOptionalFiles: matrix.missingOptionalFiles,
  };
};