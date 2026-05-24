import { fromPromise } from 'xstate';

import { idempotencyCoordinatorMachine } from './idempotency-coordinator.machine';
import { persistenceBatchMachine } from './persistence-batch.machine';
import { streamTransportMachine } from './stream-transport.machine';
import { toolWorkflowMachine } from './tool-workflow.machine';
import { usageMachine } from './usage.machine';
import { generationFallbackActor } from './generation-fallback.actor';
import { buildExtractionStructuredPayload } from './generation/extraction-parsers';
import { getRegistrySelector } from './generation-routing';
import { isExtractionPayloadSemanticallyValid } from './generation-system.events';
import type { GenerationMachineContext } from './generation-system.types';
import { executeApiAcquisition } from '../runtime/integrations/api-acquisition.adapter';
import type { ResolvedApiServiceForAcquisition } from '../adapters/api-service.adapter';

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!isPlainRecord(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === null || item === undefined) {
      continue;
    }
    normalized[key] = String(item);
  }

  return normalized;
};

const toUnknownRecord = (value: unknown): Record<string, unknown> => {
  return isPlainRecord(value) ? value : {};
};

const resolveAcquisitionInput = (context: GenerationMachineContext): {
  service: ResolvedApiServiceForAcquisition;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: Record<string, unknown>;
} | null => {
  const directAcquisition = context.requestInput.acquisition;
  const extractionPayload = context.requestInput.extractionPayload;
  const payloadAcquisition = isPlainRecord(extractionPayload)
    ? extractionPayload.acquisition
    : undefined;
  const acquisition = isPlainRecord(directAcquisition)
    ? directAcquisition
    : payloadAcquisition;

  if (!isPlainRecord(acquisition)) {
    return null;
  }

  const service = acquisition.service;
  if (!isPlainRecord(service)) {
    return null;
  }

  return {
    service: service as ResolvedApiServiceForAcquisition,
    query: toStringRecord(acquisition.query),
    headers: toStringRecord(acquisition.headers),
    body: toUnknownRecord(acquisition.body),
  };
};

export const generationSystemActors = {
  invokeIdempotency: idempotencyCoordinatorMachine,
  invokeUsage: usageMachine,
  invokeOwnership: fromPromise(
    async ({ input }: { input: { context: GenerationMachineContext } }) => {
      const { context } = input;
      const result = await context.adapters.ownership.checkProjectOwnership({
        userId: context.userId ?? 'anonymous',
        projectId: context.projectId ?? 'unknown-project',
      });

      if (!result.owned) {
        return {
          type: 'OWNERSHIP_REJECTED' as const,
          reason: result.reason ?? 'ownership_forbidden',
        };
      }

      return {
        type: 'OWNERSHIP_OK' as const,
      };
    },
  ),
  invokeStream: streamTransportMachine,
  invokePersistence: persistenceBatchMachine,
  invokeExtraction: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
    const payload = buildExtractionStructuredPayload(input.context);

    if (!isExtractionPayloadSemanticallyValid(payload)) {
      return {
        type: 'EXTRACTION_ATTEMPT_REJECTED' as const,
        reason: 'extraction_context_insufficient',
      };
    }

    return {
      type: 'EXTRACTION_ATTEMPT_ACCEPTED' as const,
      artifactId: input.context.artifactId ?? input.context.artifactIdFactory(),
      content: JSON.stringify(payload, null, 2),
      structuredPayload: payload,
    };
  }),
  invokeApiAcquisition: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
    const acquisitionInput = resolveAcquisitionInput(input.context);
    if (!acquisitionInput) {
      return {
        type: 'ACQUISITION_ATTEMPT_SKIPPED' as const,
        reason: 'acquisition_not_configured',
      };
    }

    const result = await executeApiAcquisition({
      service: acquisitionInput.service,
      query: acquisitionInput.query,
      headers: acquisitionInput.headers,
      body: acquisitionInput.body,
    });

    return {
      type: 'ACQUISITION_ATTEMPT_ACCEPTED' as const,
      statusCode: result.statusCode,
      payload: result.payload,
    };
  }),
  invokeToolWorkflow: toolWorkflowMachine,
  invokeFallbackPolicy: generationFallbackActor,
  markCompletedIdempotency: fromPromise(
    async ({ input }: { input: { context: GenerationMachineContext } }) => {
      const { context } = input;
      if (!context.userId || !context.projectId || !context.idempotencyKey || !context.artifactId) {
        return;
      }

      await context.adapters.idempotency.markCompleted(
        {
          requestId: context.requestId,
          userId: context.userId,
          projectId: context.projectId,
          workflowType: context.workflowType,
          idempotencyKey: context.idempotencyKey,
          ...getRegistrySelector(context),
        },
        context.artifactId,
        context.contentBuffer,
      );
    },
  ),
  markFailedIdempotency: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
    const { context } = input;
    if (!context.userId || !context.projectId || !context.idempotencyKey) {
      return;
    }

    await context.adapters.idempotency.markFailed({
      requestId: context.requestId,
      userId: context.userId,
      projectId: context.projectId,
      workflowType: context.workflowType,
      idempotencyKey: context.idempotencyKey,
      ...getRegistrySelector(context),
    });
  }),
};

export type GenerationSystemProvidedActor =
  | { src: 'invokeIdempotency'; logic: typeof generationSystemActors.invokeIdempotency; id: string | undefined }
  | { src: 'invokeUsage'; logic: typeof generationSystemActors.invokeUsage; id: string | undefined }
  | { src: 'invokeOwnership'; logic: typeof generationSystemActors.invokeOwnership; id: string | undefined }
  | { src: 'invokeStream'; logic: typeof generationSystemActors.invokeStream; id: string | undefined }
  | { src: 'invokePersistence'; logic: typeof generationSystemActors.invokePersistence; id: string | undefined }
  | { src: 'invokeExtraction'; logic: typeof generationSystemActors.invokeExtraction; id: string | undefined }
  | { src: 'invokeApiAcquisition'; logic: typeof generationSystemActors.invokeApiAcquisition; id: string | undefined }
  | { src: 'invokeToolWorkflow'; logic: typeof generationSystemActors.invokeToolWorkflow; id: string | undefined }
  | { src: 'invokeFallbackPolicy'; logic: typeof generationSystemActors.invokeFallbackPolicy; id: string | undefined }
  | { src: 'markCompletedIdempotency'; logic: typeof generationSystemActors.markCompletedIdempotency; id: string | undefined }
  | { src: 'markFailedIdempotency'; logic: typeof generationSystemActors.markFailedIdempotency; id: string | undefined };