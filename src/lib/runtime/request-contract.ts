import type {
  AuthOkEvent,
  RequestReceivedEvent,
  ValidationOkEvent,
} from '../types/xstate';
import type { OutputFormat } from '../types/artifact';

export type BackendGenerationRequest = {
  requestId: string;
  userId: string;
  projectId: string;
  artifactType: RequestReceivedEvent['artifactType'];
  model: string;
  input: Record<string, unknown>;
  toolKey?: string | null;
  workflowType?: string | null;
  idempotencyKey?: string;
  outputFormat?: OutputFormat;
  registryVersion?: string;
  registrySnapshotRef?: string;
};

const toOutputFormat = (value: OutputFormat | undefined): OutputFormat => {
  if (value === 'json' || value === 'markdown' || value === 'plain') {
    return value;
  }

  return 'plain';
};

export const buildRequestReceivedEvent = (
  request: BackendGenerationRequest,
): RequestReceivedEvent => {
  const enrichedInput = {
    ...request.input,
    outputFormat: toOutputFormat(request.outputFormat),
  };

  const common = {
    type: 'REQUEST_RECEIVED' as const,
    requestId: request.requestId,
    projectId: request.projectId,
    toolKey: request.toolKey ?? null,
    artifactType: request.artifactType,
    model: request.model,
    input: enrichedInput,
    workflowType: request.workflowType ?? null,
  };

  const withIdempotency = request.idempotencyKey
    ? { idempotencyKey: request.idempotencyKey }
    : {};

  if (request.registryVersion) {
    return {
      ...common,
      ...withIdempotency,
      registryVersion: request.registryVersion as never,
      registrySnapshotRef: request.registrySnapshotRef as never,
    };
  }

  return {
    ...common,
    ...withIdempotency,
    registrySnapshotRef: (request.registrySnapshotRef ?? 'snapshot:default') as never,
  };
};

export const buildAuthOkEvent = (request: BackendGenerationRequest): AuthOkEvent => ({
  type: 'AUTH_OK',
  userId: request.userId,
});

export const buildValidationOkEvent = (
  request: BackendGenerationRequest,
): ValidationOkEvent => ({
  type: 'VALIDATION_OK',
  workflowType: request.workflowType ?? null,
  registryVersion: (request.registryVersion ?? null) as never,
  registrySnapshotRef: (request.registrySnapshotRef ?? null) as never,
});
