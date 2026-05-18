import type { ServerResponse } from 'node:http';

import { writeJson } from './http-utils';
import type { BackendGenerationRequest } from './request-contract';

export type OwnershipCheck = (
  userId: string,
  projectId: string,
  correlationId?: string,
) => Promise<{ owned: boolean; reason?: 'ownership_forbidden' | 'project_not_found' | string }>;

export type ModelAvailabilityCheck = (
  modelKey: string,
  correlationId?: string,
) => Promise<boolean>;

export const applyOwnershipGuard = async (
  response: ServerResponse,
  request: BackendGenerationRequest,
  correlationId: string,
  checkProjectOwnership?: OwnershipCheck,
): Promise<boolean> => {
  if (!checkProjectOwnership) {
    return true;
  }

  const ownership = await checkProjectOwnership(request.userId, request.projectId, correlationId);
  if (ownership.owned) {
    return true;
  }

  const reason = ownership.reason ?? 'ownership_forbidden';
  const status = reason === 'project_not_found' ? 404 : 403;
  writeJson(response, status, {
    ok: false,
    error: {
      code: status === 404 ? 'not_found' : 'forbidden',
      message: reason,
    },
  });

  return false;
};

export const applyModelAvailabilityGuard = async (
  response: ServerResponse,
  request: BackendGenerationRequest,
  correlationId: string,
  checkModelAvailability?: ModelAvailabilityCheck,
): Promise<{ allowed: boolean; isAvailable: boolean | null }> => {
  if (!checkModelAvailability) {
    return { allowed: true, isAvailable: null };
  }

  const isAvailable = await checkModelAvailability(request.model, correlationId);
  if (isAvailable) {
    return { allowed: true, isAvailable };
  }

  writeJson(response, 400, {
    ok: false,
    error: {
      code: 'bad_request',
      message: 'model_unavailable',
    },
  });

  return { allowed: false, isAvailable };
};
