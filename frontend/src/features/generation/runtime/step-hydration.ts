import type { GenerationArtifact } from '../ui/artifact-history';
import type { SupportedTool, ToolStep } from '../../tools/machines/tool-flow.machine';
import type { ExtractionContext } from './GenerationWorkspaceProvider';
import { normalizeIdentifier } from '../../../app/runtime/shared-utils';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Canonical extraction payload read path.
 *
 * Priority:
 *  1. `input.extraction.payload` — BE-canonical envelope persisted by `toPersistenceInputJson`.
 *  2. `JSON.parse(artifact.content)` — extraction artifact content (fallback for older artifacts
 *     persisted before `extraction` envelope was introduced).
 *  3. `input.extractionPayload` — non-extraction artifacts that carry the payload inline.
 *
 * Callers should not add further fallbacks; add them here to keep the read path in one place.
 */
export const readExtractionPayloadFromArtifact = (artifact: GenerationArtifact): Record<string, unknown> => {
  const input = artifact.sourceRequest?.input;

  // 1. BE-canonical envelope
  const extraction = input?.extraction;
  if (isRecord(extraction)) {
    const canonicalPayload = extraction.payload;
    if (isRecord(canonicalPayload) && Object.keys(canonicalPayload).length > 0) {
      return canonicalPayload;
    }
  }

  // 2. Extraction artifact content (direct JSON)
  if (artifact.artifactType === 'extraction' && artifact.content) {
    try {
      const parsed = JSON.parse(artifact.content) as unknown;
      if (isRecord(parsed) && Object.keys(parsed).length > 0) {
        return parsed;
      }
    } catch {
      // fall through
    }
  }

  // 3. Legacy inline field
  const legacyPayload = input?.extractionPayload;
  if (isRecord(legacyPayload)) {
    return legacyPayload;
  }

  return {};
};


export const belongsToTool = (artifact: GenerationArtifact, toolKey: SupportedTool): boolean => {
  const candidates = [
    normalizeIdentifier(artifact.toolKey),
    normalizeIdentifier(artifact.workflowType),
    normalizeIdentifier(artifact.sourceRequest.toolKey),
    normalizeIdentifier(artifact.sourceRequest.workflowType),
  ];

  return candidates.includes(toolKey);
};

export const collectCompletedStepsByTool = (
  artifacts: GenerationArtifact[],
  toolKey: SupportedTool,
  projectId: string,
): Set<ToolStep> => {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return new Set();
  }

  return new Set(
    artifacts
      .filter((artifact) => (
        artifact.projectId === normalizedProjectId
        && artifact.status === 'completed'
        && belongsToTool(artifact, toolKey)
      ))
      .map((artifact) => artifact.sourceRequest.input?.step)
      .filter((step): step is ToolStep => typeof step === 'string'),
  );
};

export const buildLatestArtifactByStep = (
  artifacts: GenerationArtifact[],
  toolKey: SupportedTool,
  projectId: string,
): Partial<Record<ToolStep, GenerationArtifact>> => {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return {};
  }

  const sorted = [...artifacts]
    .filter((artifact) => artifact.projectId === normalizedProjectId && belongsToTool(artifact, toolKey))
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


export const collectCompletedRunSteps = (
  artifacts: GenerationArtifact[],
  toolKey: SupportedTool,
  projectId: string,
  runRequestPrefix: string,
): Set<ToolStep> => {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId || !runRequestPrefix.trim()) {
    return new Set();
  }

  return new Set(
    artifacts
      .filter((artifact) => (
        artifact.projectId === normalizedProjectId
        && artifact.status === 'completed'
        && typeof artifact.requestId === 'string'
        && artifact.requestId.startsWith(`${runRequestPrefix}:`)
        && belongsToTool(artifact, toolKey)
      ))
      .map((artifact) => artifact.sourceRequest.input?.step)
      .filter((step): step is ToolStep => typeof step === 'string'),
  );
};

/**
 * Extract the step value from an artifact's source request input.
 * Consolidates the pattern `artifact?.sourceRequest.input?.step` that appears 6+ times.
 * Returns null if step is not a string or artifact is null.
 */
export const extractArtifactStep = (artifact: GenerationArtifact | null): ToolStep | null => {
  const step = artifact?.sourceRequest.input?.step;
  return typeof step === 'string' ? (step as ToolStep) : null;
};

export const buildExtractionContextFromArtifact = (
  artifact: GenerationArtifact,
): ExtractionContext | null => {
  const input = artifact.sourceRequest.input;
  // When the artifact IS an extraction artifact, it itself is the extraction result.
  // Use its own artifactId as the extractionArtifactId and parse its content as payload.
  const isExtractionArtifact = artifact.artifactType === 'extraction';
  const briefingId = (() => {
    const raw = typeof input?.briefingId === 'string' ? input.briefingId.trim() : '';
    if (raw.length > 0) {
      return raw;
    }

    // Legacy extraction artifacts may not carry briefingId in sourceRequest.input.
    // Keep recovery deterministic by using the extraction artifact id as fallback key.
    return isExtractionArtifact ? artifact.artifactId : '';
  })();

  const extractionArtifactId = isExtractionArtifact
    ? artifact.artifactId
    : (typeof input?.extractionArtifactId === 'string' ? input.extractionArtifactId.trim() : '');

  if (!briefingId || !extractionArtifactId) {
    return null;
  }

  const extractionPayload = readExtractionPayloadFromArtifact(artifact);

  const normalizedText = typeof input?.briefingText === 'string'
    ? input.briefingText
    : '';

  const parsedFormat = (() => {
    const raw = typeof input?.parsedFormat === 'string' ? input.parsedFormat.trim().toLowerCase() : '';
    if (raw === 'txt' || raw === 'md' || raw === 'docx') {
      return raw;
    }

    return 'md';
  })();

  return {
    projectId: artifact.projectId,
    briefingId,
    extractionArtifactId,
    extractionPayload,
    normalizedText,
    parsedFormat,
    updatedAt: artifact.updatedAt,
  };
};
