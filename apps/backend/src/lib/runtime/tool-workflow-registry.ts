/**
 * Backend canonical step-order registry for multi-step ToolWorkflow execution.
 * Implementation label: ToolRunOrchestrator (PAT-004 — not a UL canonical term).
 * Canonical DDD terms: WorkflowStep (DDD-003), ToolWorkflow (glossary Generation context).
 *
 * This registry mirrors the frontend `toolStepOrder` constant (DDD-019) so the backend
 * can resolve step dependency artifact IDs without requiring the frontend to compute them.
 */

import {
  TOOL_KEYS,
  TOOL_STEP_ORDER,
  TOOL_WORKFLOW_BY_TOOL_KEY,
  isToolKey,
  type ToolKey as SupportedToolWorkflow,
} from '@gen-app-2/contracts';
import type { WorkflowStepDescriptor } from '../types/xstate';
import {
  assertGenerationRouteDeadline,
  type GenerationRouteDeadline,
} from './generation-route-pipeline';
import { normalizeStepKey, normalizeToolWorkflowKey } from './workflow-normalizers';

export const isSupportedToolWorkflow = isToolKey;

/**
 * Canonical dependency-graph plan for a ToolWorkflow.
 * Exported so generation-system.machine.ts can import instead of defining locally.
 * `dependencyGraph` is always derived from `steps[*].dependencies` via `buildWorkflowPlan`.
 */
export type ToolWorkflowPlan = {
  toolKey: SupportedToolWorkflow;
  steps: WorkflowStepDescriptor[];
  dependencyGraph: Record<string, string[]>;
};

/**
 * Builds a `ToolWorkflowPlan` from `toolKey` and `steps`, deriving `dependencyGraph`
 * automatically from `steps[*].dependencies` so the two cannot diverge.
 */
const buildWorkflowPlan = (
  toolKey: SupportedToolWorkflow,
  steps: WorkflowStepDescriptor[],
): ToolWorkflowPlan => ({
  toolKey,
  steps,
  dependencyGraph: Object.fromEntries(steps.map((s) => [s.key, s.dependencies])),
});

/**
 * Registry of all supported ToolWorkflow plans.
 * Single source of truth for step ordering and dependency graphs in the backend.
 * Mirrors `toolStepOrder` / `stepDependencies` from the frontend tool-form-architecture.ts.
 *
 * `dependencyGraph` is derived from `steps` by `buildWorkflowPlan` — do not add it manually.
 */
export const TOOL_WORKFLOW_REGISTRY: Record<SupportedToolWorkflow, ToolWorkflowPlan> = {
  ...Object.fromEntries(
    TOOL_KEYS.map((toolKey) => [
      toolKey,
      buildWorkflowPlan(
        toolKey,
        TOOL_WORKFLOW_BY_TOOL_KEY[toolKey].steps.map((step) => ({
          key: step.key,
          dependencies: [...step.dependencies],
        })),
      ),
    ]),
  ),
} as Record<SupportedToolWorkflow, ToolWorkflowPlan>;

/**
 * Ordered step keys per ToolWorkflow. Derived from `TOOL_WORKFLOW_REGISTRY` so step order
 * cannot diverge between the registry and this lookup table.
 */
export const toolWorkflowStepOrder: Record<SupportedToolWorkflow, string[]> = Object.fromEntries(
  TOOL_KEYS.map((toolKey) => [toolKey, TOOL_STEP_ORDER[toolKey]]),
) as Record<SupportedToolWorkflow, string[]>;

/**
 * Given a target step and a map of already-completed step → artifactId,
 * returns the ordered dependency artifact IDs for the target step.
 */
export const resolveStepDependencyIds = (
  toolKey: SupportedToolWorkflow,
  targetStep: string,
  completedArtifactsByStep: Record<string, string>,
): { stepDependencyArtifactIds: string[]; dependencyArtifactIdsByStep: Record<string, string> } => {
  const order = toolWorkflowStepOrder[toolKey];
  const stepIndex = order.indexOf(targetStep);

  if (stepIndex <= 0) {
    return { stepDependencyArtifactIds: [], dependencyArtifactIdsByStep: {} };
  }

  const priorSteps = order.slice(0, stepIndex);
  const dependencyArtifactIdsByStep: Record<string, string> = {};

  for (const step of priorSteps) {
    const artifactId = completedArtifactsByStep[step];
    if (typeof artifactId === 'string' && artifactId.trim().length > 0) {
      dependencyArtifactIdsByStep[step] = artifactId;
    }
  }

  const stepDependencyArtifactIds = Object.values(dependencyArtifactIdsByStep);
  return { stepDependencyArtifactIds, dependencyArtifactIdsByStep };
};

export type CompletedToolArtifactSummary = {
  artifactId: string;
  workflowType: string | null;
  artifactType: string;
  stepKey?: string | null;
};

export type CompletedToolArtifactDetail = {
  artifactId: string;
  input: Record<string, unknown>;
};

export const buildCompletedArtifactsByStep = async (
  userId: string,
  toolKey: SupportedToolWorkflow,
  summaries: CompletedToolArtifactSummary[],
  getArtifactDetail: (userId: string, artifactId: string) => Promise<CompletedToolArtifactDetail | null>,
  route: string,
  correlationId: string,
  deadline?: GenerationRouteDeadline,
): Promise<Record<string, string>> => {
  const completedArtifactsByStep: Record<string, string> = {};
  const toolArtifacts = summaries.filter(
    (artifact) => normalizeToolWorkflowKey(artifact.workflowType) === toolKey && artifact.artifactType !== 'extraction',
  );

  for (const summary of toolArtifacts) {
    if (deadline) {
      assertGenerationRouteDeadline(deadline, route, correlationId);
    }

    const summaryStepKey = normalizeStepKey(summary.stepKey);
    if (summaryStepKey && !(summaryStepKey in completedArtifactsByStep)) {
      completedArtifactsByStep[summaryStepKey] = summary.artifactId;
      continue;
    }

    const detail = await getArtifactDetail(userId, summary.artifactId);
    if (!detail) {
      continue;
    }

    const step = extractStepFromArtifactInput(detail.input);
    if (step && !(step in completedArtifactsByStep)) {
      completedArtifactsByStep[step] = detail.artifactId;
    }
  }

  return completedArtifactsByStep;
};

/**
 * Extracts the step key from an artifact input record.
 * Checks `toolWorkflow.stepKey` first (set by normalizeToolWorkflowInputJson),
 * then falls back to top-level `step` field (set by FE createStepRequest).
 */
export const extractStepFromArtifactInput = (input: Record<string, unknown>): string | null => {
  const toolWorkflow = input.toolWorkflow;
  if (
    toolWorkflow &&
    typeof toolWorkflow === 'object' &&
    !Array.isArray(toolWorkflow) &&
    typeof (toolWorkflow as Record<string, unknown>).stepKey === 'string'
  ) {
    const stepKey = (toolWorkflow as Record<string, unknown>).stepKey as string;
    if (stepKey.trim().length > 0) {
      return stepKey.trim();
    }
  }

  if (typeof input.step === 'string' && input.step.trim().length > 0) {
    return input.step.trim();
  }

  return null;
};
