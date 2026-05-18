import type { PersistenceBatchInput, RegistryBackedWorkflowType } from '../types/xstate';
import type { RouteType } from './generation-routing';
import { buildToolWorkflowPersistenceMetadata, getRegistrySelector } from './generation-routing';
import { parseExtractionContent } from './generation/extraction-parsers';
import { toOptionalString, toStringArray } from './generation/request-normalizers';

type GenerationPersistenceContext = {
  requestId: string;
  sessionId: string | null;
  userId: string | null;
  projectId: string | null;
  toolKey: string | null;
  registryVersion: string | null;
  registrySnapshotRef: string | null;
  workflowType: RegistryBackedWorkflowType;
  artifactType: string;
  artifactId: string | null;
  contentBuffer: string;
  requestInput: Record<string, unknown>;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  routeType: RouteType;
};

export const toPersistenceArtifactType = (
  context: GenerationPersistenceContext,
): string => {
  if (context.routeType === 'extraction') {
    return 'extraction';
  }

  return context.artifactType;
};

export const toPersistenceWorkflowType = (
  context: GenerationPersistenceContext,
): RegistryBackedWorkflowType => {
  if (context.routeType === 'extraction') {
    return 'extraction';
  }

  return context.workflowType;
};

export const toPersistenceInputJson = (
  context: GenerationPersistenceContext,
): Record<string, unknown> => {
  if (context.routeType !== 'extraction') {
    const toolWorkflow = buildToolWorkflowPersistenceMetadata(context);
    if (!toolWorkflow) {
      return context.requestInput;
    }

    return {
      ...context.requestInput,
      toolWorkflow,
    };
  }

  const extractionPayload = parseExtractionContent(
    context.contentBuffer,
    toOptionalString(context.requestInput.toolKey),
  );

  return {
    ...context.requestInput,
    extraction: {
      briefingId: toOptionalString(context.requestInput.briefingId),
      extractionArtifactId:
        toOptionalString(context.requestInput.extractionArtifactId) ?? context.artifactId,
      stepDependencyArtifactIds: toStringArray(context.requestInput.stepDependencyArtifactIds),
      payload: extractionPayload,
    },
  };
};

export const buildPersistenceBatchInput = (
  context: GenerationPersistenceContext,
  artifactId: string,
): PersistenceBatchInput => ({
  requestId: context.requestId,
  artifactId,
  artifactType: toPersistenceArtifactType(context),
  workflowType: toPersistenceWorkflowType(context),
  contentBuffer: context.contentBuffer,
  ...(context.sessionId ? { sessionId: context.sessionId } : {}),
  ...(context.userId ? { userId: context.userId } : {}),
  ...(context.projectId ? { projectId: context.projectId } : {}),
  model: context.model,
  inputJson: toPersistenceInputJson(context),
  inputTokens: Math.max(
    context.inputTokens,
    Math.max(0, Math.ceil(JSON.stringify(context.requestInput).length / 4)),
  ),
  outputTokens: Math.max(
    context.outputTokens,
    Math.max(0, Math.ceil(context.contentBuffer.length / 4)),
  ),
  costUsd:
    context.costUsd > 0
      ? context.costUsd
      : Number((Math.max(1, context.contentBuffer.length) * 0.000001).toFixed(6)),
  ...getRegistrySelector(context),
});