/**
 * Backend canonical step-order registry for multi-step ToolWorkflow execution.
 * Implementation label: ToolRunOrchestrator (PAT-004 — not a UL canonical term).
 * Canonical DDD terms: WorkflowStep (DDD-003), ToolWorkflow (glossary Generation context).
 *
 * This registry mirrors the frontend `toolStepOrder` constant (DDD-019) so the backend
 * can resolve step dependency artifact IDs without requiring the frontend to compute them.
 */

import type { WorkflowStepDescriptor } from '../types/xstate';

export type SupportedToolWorkflow = 'funnel-pages' | 'nextland';

/**
 * Ordered step keys per ToolWorkflow. Mirrors frontend `toolStepOrder` in tool-flow.machine.ts.
 */
export const toolWorkflowStepOrder: Record<SupportedToolWorkflow, string[]> = {
  'funnel-pages': ['optin', 'quiz', 'vsl'],
  nextland: ['landing', 'thank_you'],
};

export const isSupportedToolWorkflow = (value: string): value is SupportedToolWorkflow =>
  value === 'funnel-pages' || value === 'nextland';

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

/**
 * Canonical dependency-graph plan for a ToolWorkflow.
 * Exported so generation-system.machine.ts can import instead of defining locally.
 */
export type ToolWorkflowPlan = {
  toolKey: string;
  steps: WorkflowStepDescriptor[];
  dependencyGraph: Record<string, string[]>;
};

/**
 * Registry of all supported ToolWorkflow plans.
 * Single source of truth for step ordering and dependency graphs in the backend.
 * Mirrors `toolStepOrder` / `stepDependencies` from the frontend tool-form-architecture.ts.
 */
export const TOOL_WORKFLOW_REGISTRY: Record<string, ToolWorkflowPlan> = {
  'funnel-pages': {
    toolKey: 'funnel-pages',
    steps: [
      { key: 'optin', dependencies: [] },
      { key: 'quiz', dependencies: ['optin'] },
      { key: 'vsl', dependencies: ['optin', 'quiz'] },
    ],
    dependencyGraph: {
      optin: [],
      quiz: ['optin'],
      vsl: ['optin', 'quiz'],
    },
  },
  nextland: {
    toolKey: 'nextland',
    steps: [
      { key: 'landing', dependencies: [] },
      { key: 'thank_you', dependencies: ['landing'] },
    ],
    dependencyGraph: {
      landing: [],
      thank_you: ['landing'],
    },
  },
};
