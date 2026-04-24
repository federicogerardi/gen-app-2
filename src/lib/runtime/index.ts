import type { GenerationAdapters } from '../adapters';

import {
  runBackendGenerationSession,
  type BackendSessionResult,
} from './backend-session';
import type { BackendGenerationRequest } from './request-contract';
import { serializeSseEvent } from './stream-contract';

export type HandleGenerationRequestResult = BackendSessionResult & {
  ssePayload: string;
};

export const handleGenerationRequest = async (
  request: BackendGenerationRequest,
  adapters: GenerationAdapters,
): Promise<HandleGenerationRequestResult> => {
  const result = await runBackendGenerationSession(request, adapters);

  return {
    ...result,
    ssePayload: result.streamEvents.map(serializeSseEvent).join(''),
  };
};

export type { BackendGenerationRequest } from './request-contract';
export type { BackendError } from './error-contract';
export type { BackendStreamEvent } from './stream-contract';
