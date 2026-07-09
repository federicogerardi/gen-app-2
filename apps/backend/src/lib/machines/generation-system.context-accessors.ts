import type {
  GenerationDomainContext,
  GenerationRuntimeContext,
  GenerationMetricsContext,
  GenerationInfraContext,
  GenerationErrorContext,
  DecomposedGenerationContext,
} from './generation-system.context-types';
import type { GenerationMachineContext } from './generation-system.types';

export function selectDomainContext(context: GenerationMachineContext): GenerationDomainContext {
  return {
    requestId: context.requestId,
    userId: context.userId,
    projectId: context.projectId,
    sessionId: context.sessionId,
    toolKey: context.toolKey,
    workflowType: context.workflowType,
    artifactType: context.artifactType,
    artifactId: context.artifactId,
    contentBuffer: context.contentBuffer,
    failureReason: context.failureReason,
  };
}

export function selectRuntimeContext(context: GenerationMachineContext): GenerationRuntimeContext {
  return {
    model: context.model,
    requestInput: context.requestInput,
    idempotencyKey: context.idempotencyKey,
    outputFormat: context.outputFormat,
    syntheticResponse: context.syntheticResponse,
    routeType: context.routeType,
    effectiveModelResolution: context.effectiveModelResolution,
    mode: context.mode,
  };
}

export function selectMetricsContext(context: GenerationMachineContext): GenerationMetricsContext {
  return {
    inputTokens: context.inputTokens,
    outputTokens: context.outputTokens,
    costUsd: context.costUsd,
    _creditCost: context._creditCost,
  };
}

export function selectInfraContext(context: GenerationMachineContext): GenerationInfraContext {
  return {
    adapters: context.adapters,
    runtimeNow: context.runtimeNow,
    artifactIdFactory: context.artifactIdFactory,
    responseBuilder: context.responseBuilder,
  };
}

export function selectErrorContext(context: GenerationMachineContext): GenerationErrorContext {
  return {
    pendingFallback: context.pendingFallback,
    registryVersion: context.registryVersion,
    registrySnapshotRef: context.registrySnapshotRef,
  };
}

export function selectDecomposedContext(context: GenerationMachineContext): DecomposedGenerationContext {
  return {
    ...selectDomainContext(context),
    ...selectRuntimeContext(context),
    ...selectMetricsContext(context),
    ...selectInfraContext(context),
    ...selectErrorContext(context),
  };
}
