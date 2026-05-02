import type { GenerationArtifact } from '../ui/artifact-history';
import type { SupportedTool, ToolStep } from '../../tools/machines/tool-flow.machine';
import type { ToolExtractionContext } from './GenerationWorkspaceProvider';

const normalize = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return normalized.length > 0 ? normalized : null;
};

export const belongsToTool = (artifact: GenerationArtifact, toolKey: SupportedTool): boolean => {
  const candidates = [
    normalize(artifact.toolKey),
    normalize(artifact.workflowType),
    normalize(artifact.sourceRequest.toolKey),
    normalize(artifact.sourceRequest.workflowType),
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

export const buildExtractionContextFromArtifact = (
  artifact: GenerationArtifact,
): ToolExtractionContext | null => {
  const input = artifact.sourceRequest.input;
  const briefingId = typeof input?.briefingId === 'string' ? input.briefingId.trim() : '';
  const extractionArtifactId = typeof input?.extractionArtifactId === 'string'
    ? input.extractionArtifactId.trim()
    : '';

  if (!briefingId || !extractionArtifactId) {
    return null;
  }

  const extractionPayload = typeof input?.extractionPayload === 'object' && input.extractionPayload !== null
    ? input.extractionPayload as Record<string, unknown>
    : {};

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
