import {
  isGenerationRouteToolKey,
  isToolKey,
  isToolWorkflowType,
  type GenerationWorkflowType,
} from '@gen-app-2/contracts';
import type { IncomingMessage } from 'node:http';

import type { BackendGenerationRequest } from './request-contract';

const MAX_BODY_SIZE_BYTES = 3 * 1024 * 1024;

const requireStringField = (payload: Record<string, unknown>, field: string): string => {
  const value = payload[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`invalid_field:${field}`);
  }

  return value;
};

const requireObjectField = (payload: Record<string, unknown>, field: string): Record<string, unknown> => {
  const value = payload[field];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid_field:${field}`);
  }

  return value as Record<string, unknown>;
};

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  await new Promise<void>((resolve, reject) => {
    request.on('data', (chunk: Buffer | string) => {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += chunkBuffer.length;
      if (totalSize > MAX_BODY_SIZE_BYTES) {
        reject(new Error('request_body_too_large'));
        return;
      }

      chunks.push(chunkBuffer);
    });

    request.on('end', () => resolve());
    request.on('error', reject);
  });

  return Buffer.concat(chunks).toString('utf8');
};

export const defaultMapGenerationRequest = (
  payload: Record<string, unknown>,
): BackendGenerationRequest => {
  const rawToolKey = typeof payload.toolKey === 'string' ? payload.toolKey.trim() : null;
  const rawWorkflowType =
    typeof payload.workflowType === 'string' ? payload.workflowType.trim() : null;

  const request: BackendGenerationRequest = {
    requestId: requireStringField(payload, 'requestId'),
    userId: requireStringField(payload, 'userId'),
    projectId: requireStringField(payload, 'projectId'),
    artifactType: requireStringField(payload, 'artifactType') as BackendGenerationRequest['artifactType'],
    model: requireStringField(payload, 'model') as BackendGenerationRequest['model'],
    input: requireObjectField(payload, 'input'),
    toolKey:
      rawToolKey && (isToolKey(rawToolKey) || isGenerationRouteToolKey(rawToolKey))
        ? rawToolKey
        : null,
    workflowType:
      rawWorkflowType && (isToolWorkflowType(rawWorkflowType) || rawWorkflowType === 'extraction')
        ? (rawWorkflowType as GenerationWorkflowType)
        : null,
  };

  if (typeof payload.sessionId === 'string' && payload.sessionId.trim().length > 0) {
    request.sessionId = payload.sessionId;
  }

  if (typeof payload.idempotencyKey === 'string') {
    request.idempotencyKey = payload.idempotencyKey;
  }

  if (
    payload.outputFormat === 'json'
    || payload.outputFormat === 'markdown'
    || payload.outputFormat === 'plain'
  ) {
    request.outputFormat = payload.outputFormat;
  }

  if (typeof payload.registryVersion === 'string') {
    request.registryVersion = payload.registryVersion;
  }

  if (typeof payload.registrySnapshotRef === 'string') {
    request.registrySnapshotRef = payload.registrySnapshotRef;
  }

  return request;
};

export const parseGenerationRequest = async (
  request: IncomingMessage,
  mapGenerationRequest?: (
    payload: Record<string, unknown>,
    request: IncomingMessage,
  ) => BackendGenerationRequest,
): Promise<BackendGenerationRequest> => {
  const rawBody = await readRequestBody(request);
  if (!rawBody || rawBody.trim().length === 0) {
    throw new Error('missing_body');
  }

  const parsed = JSON.parse(rawBody) as Record<string, unknown>;
  const mapper = mapGenerationRequest ?? ((payload) => defaultMapGenerationRequest(payload));
  return mapper(parsed, request);
};
