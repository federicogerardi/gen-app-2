import type { ArtifactLifecycleStatus, GenerationArtifact } from '../ui/artifact-history';
import type { SupportedTool, ToolStep } from '../../tools/machines/tool-flow.machine';
import type { ExtractionContext } from './GenerationWorkspaceProvider';
import { normalizeIdentifier } from '../../../app/runtime/shared-utils';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeExtractionPayload = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) {
    return {};
  }

  const payload = value.payload;
  if (isRecord(payload)) {
    return payload;
  }

  const extractionPayload = value.extractionPayload;
  if (isRecord(extractionPayload)) {
    return extractionPayload;
  }

  const data = value.data;
  if (isRecord(data)) {
    const dataPayload = data.payload;
    if (isRecord(dataPayload)) {
      return dataPayload;
    }

    const dataExtractionPayload = data.extractionPayload;
    if (isRecord(dataExtractionPayload)) {
      return dataExtractionPayload;
    }
  }

  return value;
};

const parseJsonCandidate = (candidate: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return normalizeExtractionPayload(parsed);
  } catch {
    return {};
  }
};

const parseExtractionArtifactContent = (content: string): Record<string, unknown> => {
  const direct = parseJsonCandidate(content);
  if (Object.keys(direct).length > 0) {
    return direct;
  }

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = parseJsonCandidate(fenced[1]);
    if (Object.keys(fromFence).length > 0) {
      return fromFence;
    }
  }

  const objectSlice = content.match(/\{[\s\S]*\}/);
  if (objectSlice?.[0]) {
    const fromSlice = parseJsonCandidate(objectSlice[0]);
    if (Object.keys(fromSlice).length > 0) {
      return fromSlice;
    }
  }

  return {};
};

const readNormalizedBriefingText = (input: Record<string, unknown> | undefined): string => {
  if (typeof input?.briefingText === 'string' && input.briefingText.trim().length > 0) {
    return input.briefingText;
  }

  if (typeof input?.normalizedText === 'string' && input.normalizedText.trim().length > 0) {
    return input.normalizedText;
  }

  return '';
};

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

  // 2. Extraction artifact content (direct JSON, fenced JSON, or payload envelope)
  if (artifact.artifactType === 'extraction' && artifact.content) {
    const parsed = parseExtractionArtifactContent(artifact.content);
    if (Object.keys(parsed).length > 0) {
      return parsed;
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

type ArtifactFilterCriteria = {
  projectId: string;
  toolKey: SupportedTool;
  status?: ArtifactLifecycleStatus;
  runRequestPrefix?: string;
};

const filterArtifactsForStep = (
  artifacts: GenerationArtifact[],
  criteria: ArtifactFilterCriteria,
): GenerationArtifact[] => {
  const normalizedProjectId = criteria.projectId.trim();
  return artifacts.filter((artifact) => {
    if (artifact.projectId !== normalizedProjectId) return false;
    if (!belongsToTool(artifact, criteria.toolKey)) return false;
    if (criteria.status && artifact.status !== criteria.status) return false;
    if (criteria.runRequestPrefix) {
      const prefix = criteria.runRequestPrefix.trim();
      if (typeof artifact.requestId !== 'string' || !artifact.requestId.startsWith(`${prefix}:`)) return false;
    }
    return true;
  });
};

export const collectCompletedStepsByTool = (
  artifacts: GenerationArtifact[],
  toolKey: SupportedTool,
  projectId: string,
): Set<ToolStep> => {
  if (!projectId.trim()) {
    return new Set();
  }

  return new Set(
    filterArtifactsForStep(artifacts, { projectId, toolKey, status: 'completed' })
      .map(extractArtifactStep)
      .filter((step): step is ToolStep => step !== null),
  );
};

export const buildLatestArtifactByStep = (
  artifacts: GenerationArtifact[],
  toolKey: SupportedTool,
  projectId: string,
): Partial<Record<ToolStep, GenerationArtifact>> => {
  if (!projectId.trim()) {
    return {};
  }

  const sorted = [...filterArtifactsForStep(artifacts, { projectId, toolKey })]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return sorted.reduce<Partial<Record<ToolStep, GenerationArtifact>>>((acc, artifact) => {
    const step = extractArtifactStep(artifact);
    if (step !== null && !acc[step]) {
      acc[step] = artifact;
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
  if (!projectId.trim() || !runRequestPrefix.trim()) {
    return new Set();
  }

  return new Set(
    filterArtifactsForStep(artifacts, { projectId, toolKey, status: 'completed', runRequestPrefix })
      .map(extractArtifactStep)
      .filter((step): step is ToolStep => step !== null),
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

  const normalizedText = readNormalizedBriefingText(input);

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
