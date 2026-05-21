import type { RegistryBackedWorkflowType, WorkflowStepDescriptor } from '../types/xstate';
import { TOOL_WORKFLOW_REGISTRY, isSupportedToolWorkflow, type ToolWorkflowPlan } from '../runtime/tool-workflow-registry';
import { normalizeStepKey, normalizeToolWorkflowKey } from '../runtime/workflow-normalizers';
import { normalizeValue, toOptionalString, toStringArray, toStringRecord } from './generation/request-normalizers';

export type RouteType = 'generic' | 'tool' | 'extraction' | null;

type GenerationRoutingRequestInput = {
  intent?: unknown;
  step?: unknown;
  stepDependencyArtifactIds?: unknown;
  stepDependencyArtifactIdsByStep?: unknown;
  briefingId?: unknown;
  extractionArtifactId?: unknown;
  toolKey?: unknown;
};

type GenerationRoutingContext = {
  requestId: string;
  sessionId: string | null;
  toolKey: string | null;
  workflowType: RegistryBackedWorkflowType;
  routeType: RouteType;
  requestInput: GenerationRoutingRequestInput;
  registryVersion: string | null;
  registrySnapshotRef: string | null;
};

export const getRegistrySelector = (context: GenerationRoutingContext) => {
  const registrySnapshotRef =
    context.registrySnapshotRef ?? `snapshot:${context.requestId}`;

  if (context.registryVersion) {
    return {
      registryVersion: context.registryVersion,
      registrySnapshotRef,
    };
  }

  return {
    registrySnapshotRef,
  };
};

export const resolveToolWorkflowPlan = (context: Pick<GenerationRoutingContext, 'toolKey' | 'workflowType'>): ToolWorkflowPlan | null => {
  const normalizedToolKey = normalizeToolWorkflowKey(context.toolKey);
  const normalizedWorkflowType = normalizeToolWorkflowKey(context.workflowType);
  const key = normalizedToolKey ?? normalizedWorkflowType;
  if (!key || !isSupportedToolWorkflow(key)) {
    return null;
  }

  return TOOL_WORKFLOW_REGISTRY[key] ?? null;
};

export const resolveWorkflowRunMode = (
  context: Pick<GenerationRoutingContext, 'requestInput'>,
): 'new' | 'resume' | 'regenerate' => {
  const intent = normalizeValue(toOptionalString(context.requestInput.intent));
  if (intent === 'resume' || intent === 'regenerate') {
    return intent;
  }

  return 'new';
};

export const resolveRequestScopedStepDescriptor = (
  context: Pick<GenerationRoutingContext, 'requestInput' | 'toolKey'>,
  plan: ToolWorkflowPlan | null,
): WorkflowStepDescriptor => {
  const requestedStep = normalizeStepKey(context.requestInput.step);
  if (plan && requestedStep) {
    const found = plan.steps.find((candidate) => candidate.key === requestedStep);
    if (found) {
      return found;
    }
  }

  if (plan) {
    return plan.steps[0] ?? { key: context.toolKey ?? 'workflow_step', dependencies: [] };
  }

  return {
    key: requestedStep ?? context.toolKey ?? 'workflow_step',
    dependencies: [],
  };
};

export const isFinalStepForPlan = (plan: ToolWorkflowPlan | null, stepKey: string): boolean => {
  if (!plan || plan.steps.length === 0) {
    return true;
  }

  const last = plan.steps[plan.steps.length - 1];
  return last?.key === stepKey;
};

type BuildToolWorkflowPersistenceMetadataContext = Pick<
  GenerationRoutingContext,
  'requestId' | 'sessionId' | 'toolKey' | 'workflowType' | 'routeType' | 'requestInput'
>;

export const buildToolWorkflowPersistenceMetadata = (
  context: BuildToolWorkflowPersistenceMetadataContext,
): Record<string, unknown> | null => {
  if (context.routeType !== 'tool') {
    return null;
  }

  const plan = resolveToolWorkflowPlan(context);
  const stepDescriptor = resolveRequestScopedStepDescriptor(context, plan);
  const dependsOnSteps = plan?.dependencyGraph[stepDescriptor.key] ?? stepDescriptor.dependencies;
  const dependencyArtifactIds = toStringArray(context.requestInput.stepDependencyArtifactIds);
  const dependencyArtifactIdsByStep = toStringRecord(context.requestInput.stepDependencyArtifactIdsByStep);

  if (Object.keys(dependencyArtifactIdsByStep).length === 0 && dependencyArtifactIds.length > 0) {
    dependsOnSteps.forEach((dependencyStepKey, index) => {
      const artifactId = dependencyArtifactIds[index];
      if (artifactId) {
        dependencyArtifactIdsByStep[dependencyStepKey] = artifactId;
      }
    });
  }

  return {
    sessionId: context.sessionId,
    toolKey: plan?.toolKey ?? context.toolKey,
    workflowType: context.workflowType,
    runMode: resolveWorkflowRunMode(context),
    artifactRole: isFinalStepForPlan(plan, stepDescriptor.key) ? 'final' : 'step',
    stepKey: stepDescriptor.key,
    dependsOnSteps,
    dependencyArtifactIds,
    dependencyArtifactIdsByStep,
  };
};

export const getRouteType = (
  toolKey: string | null,
  workflowType: RegistryBackedWorkflowType,
  artifactType: string,
): RouteType => {
  const normalizedToolKey = normalizeValue(toolKey);
  const normalizedWorkflowType = normalizeValue(workflowType ?? null);
  const normalizedArtifactType = normalizeValue(artifactType);

  if (
    normalizedToolKey === 'extraction' ||
    normalizedWorkflowType === 'extraction' ||
    normalizedArtifactType === 'extraction'
  ) {
    return 'extraction';
  }

  if (normalizedToolKey !== null && normalizedToolKey !== 'extraction') {
    return 'tool';
  }

  if (normalizedToolKey === null && normalizedWorkflowType === null) {
    return 'generic';
  }

  return null;
};