import type { GenerationSystemEvent } from '../types/xstate';
import {
  getAcquisitionDoneOutput,
  getExtractionDoneOutput,
  getIdempotencyDoneOutput,
  getOwnershipDoneOutput,
  getStreamDoneOutput,
  getToolDoneOutput,
  getUsageDoneOutput,
  isEmptyStreamSuccess,
} from './generation-system.events';
import type { GenerationMachineContext } from './generation-system.types';

type GenerationGuardArgs = {
  context: GenerationMachineContext;
  event: GenerationSystemEvent;
};

export const generationSystemGuards = {
  hasRegistrySelector: ({ event }: GenerationGuardArgs) =>
    event.type !== 'REQUEST_RECEIVED'
      ? true
      : Boolean(event.registryVersion || event.registrySnapshotRef),
  hasAmbiguousRouting: ({ context }: GenerationGuardArgs) => context.routeType === null,
  routeIsExtraction: ({ context }: GenerationGuardArgs) => context.routeType === 'extraction',
  routeIsTool: ({ context }: GenerationGuardArgs) => context.routeType === 'tool',
  routeIsGeneric: ({ context }: GenerationGuardArgs) => context.routeType === 'generic',
  hasApiAcquisition: ({ context }: GenerationGuardArgs) => {
    const acquisition = context.requestInput.acquisition;
    if (!acquisition || typeof acquisition !== 'object' || Array.isArray(acquisition)) {
      return false;
    }

    const service = (acquisition as Record<string, unknown>).service;
    return Boolean(service && typeof service === 'object' && !Array.isArray(service));
  },
  idempotencyOutputIsReplay: ({ event }: GenerationGuardArgs) =>
    (getIdempotencyDoneOutput(event).type ?? '') === 'IDEMPOTENCY_REPLAY_READY',
  idempotencyOutputIsConflict: ({ event }: GenerationGuardArgs) =>
    (getIdempotencyDoneOutput(event).type ?? '') === 'IDEMPOTENCY_CONFLICT',
  usageOutputIsRejected: ({ event }: GenerationGuardArgs) =>
    getUsageDoneOutput(event)?.type === 'USAGE_REJECTED',
  ownershipOutputIsRejected: ({ event }: GenerationGuardArgs) =>
    getOwnershipDoneOutput(event)?.type === 'OWNERSHIP_REJECTED',
  streamOutputIsFailure: ({ event }: GenerationGuardArgs) =>
    getStreamDoneOutput(event)?.type === 'STREAM_TERMINATED_FAILURE',
  streamOutputIsEmptySuccess: ({ context, event }: GenerationGuardArgs) =>
    context.routeType !== 'extraction' && isEmptyStreamSuccess(event),
  extractionOutputIsAccepted: ({ event }: GenerationGuardArgs) =>
    getExtractionDoneOutput(event)?.type === 'EXTRACTION_ATTEMPT_ACCEPTED',
  acquisitionOutputIsAccepted: ({ event }: GenerationGuardArgs) =>
    getAcquisitionDoneOutput(event)?.type === 'ACQUISITION_ATTEMPT_ACCEPTED',
  toolOutputIsCompleted: ({ event }: GenerationGuardArgs) =>
    getToolDoneOutput(event)?.type === 'WORKFLOW_STEP_COMPLETED',
};