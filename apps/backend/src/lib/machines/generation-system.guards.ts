import type { GenerationSystemEvent, WorkflowStepType } from '../types/xstate';
import {
  getAcquisitionDoneOutput,
  getCrawlingDoneOutput,
  getExtractionDoneOutput,
  getIdempotencyDoneOutput,
  getOwnershipDoneOutput,
  getScoringDoneOutput,
  getStreamDoneOutput,
  getToolDoneOutput,
  getUsageDoneOutput,
  isEmptyStreamSuccess,
} from './generation-system.events';
import type { GenerationMachineContext } from './generation-system.types';
import { selectDomainContext, selectRuntimeContext } from './generation-system.context-accessors';
import {
  isFinalStepForPlan,
  resolveRequestScopedStepDescriptor,
  resolveToolWorkflowPlan,
} from './generation-routing';
import { STEP_TYPE_BY_TOOL_AND_STEP } from '../runtime/tool-workflow-registry';

type GenerationGuardArgs = {
  context: GenerationMachineContext;
  event: GenerationSystemEvent;
};

/**
 * Business Invariants / Policy guards per GenerationSystem.
 *
 * Ogni guard è una funzione pura ({ context, event }) → boolean.
 * Testabili in isolamento senza mock.
 *
 * @ddd BusinessInvariant GenerationRouting
 * @ddd Related DDD-140 DDD-138 DDD-033
 */
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
  generateOutputIsFailure: ({ event }: GenerationGuardArgs) => {
    const output = (event as { output?: { type?: string } }).output;
    return output?.type === 'GENERATE_TERMINATED_FAILURE';
  },
  streamOutputIsEmptySuccess: ({ context, event }: GenerationGuardArgs) => {
    const runtime = selectRuntimeContext(context);
    return runtime.routeType !== 'extraction' && isEmptyStreamSuccess(event);
  },
  extractionOutputIsAccepted: ({ event }: GenerationGuardArgs) =>
    getExtractionDoneOutput(event)?.type === 'EXTRACTION_ATTEMPT_ACCEPTED',
  acquisitionOutputIsAccepted: ({ event }: GenerationGuardArgs) =>
    getAcquisitionDoneOutput(event)?.type === 'ACQUISITION_ATTEMPT_ACCEPTED',
  crawlingOutputIsAccepted: ({ event }: GenerationGuardArgs) =>
    getCrawlingDoneOutput(event)?.type === 'CRAWLING_COMPLETED',
  scoringOutputIsAccepted: ({ event }: GenerationGuardArgs) =>
    getScoringDoneOutput(event)?.type === 'SCORING_COMPLETED',
  toolOutputIsCompleted: ({ event }: GenerationGuardArgs) =>
    getToolDoneOutput(event)?.type === 'WORKFLOW_STEP_COMPLETED',
  modeIsGenerate: ({ context }: GenerationGuardArgs) => context.mode === 'generate',
  routeIsCrawlingStep: ({ context }: GenerationGuardArgs) => {
    const domain = selectDomainContext(context);
    const toolKey = domain.toolKey ?? '';
    const step = (context.requestInput as Record<string, unknown>).step;
    if (!toolKey || !step || typeof step !== 'string') return false;
    const stepTypeMap = (STEP_TYPE_BY_TOOL_AND_STEP as Record<string, Record<string, WorkflowStepType> | undefined>)[toolKey as string];
    if (!stepTypeMap) return false;
    return stepTypeMap[step] === 'crawling';
  },
  routeIsScoringStep: ({ context }: GenerationGuardArgs) => {
    const domain = selectDomainContext(context);
    const toolKey = domain.toolKey ?? '';
    const step = (context.requestInput as Record<string, unknown>).step;
    if (!toolKey || !step || typeof step !== 'string') return false;
    const stepTypeMap = (STEP_TYPE_BY_TOOL_AND_STEP as Record<string, Record<string, WorkflowStepType> | undefined>)[toolKey as string];
    if (!stepTypeMap) return false;
    return stepTypeMap[step] === 'scoring';
  },
  isNotFinalArtifact: ({ context }: GenerationGuardArgs) => {
    if (context.routeType !== 'tool') {
      return false;
    }
    const plan = resolveToolWorkflowPlan(context);
    if (!plan) {
      return false;
    }
    const stepDescriptor = resolveRequestScopedStepDescriptor(context, plan);
    return !isFinalStepForPlan(plan, stepDescriptor.key);
  },
};