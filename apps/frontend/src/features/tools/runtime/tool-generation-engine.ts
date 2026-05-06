import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import { toolStepOrder } from '../machines/tool-flow.machine';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';

export { toolStepOrder };

export const createStepRequest = (
  baseRequest: GenerationRequest,
  tool: SupportedTool,
  step: ToolStep,
  dependencies: Record<string, string>,
  dependencyArtifactContentsByStep: Record<string, string> = {},
): GenerationRequest => {
  const dependencyEntries = Object.entries(dependencies).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0,
  );
  const dependencyContentEntries = Object.entries(dependencyArtifactContentsByStep).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0,
  );

  return {
    ...baseRequest,
    requestId: `${baseRequest.requestId}:${step}`,
    toolKey: tool,
    workflowType: tool,
    input: {
      ...baseRequest.input,
      intent: baseRequest.input.intent ?? 'new',
      step,
      stepDependencyArtifactIds: dependencyEntries.map(([, artifactId]) => artifactId),
      stepDependencyArtifactIdsByStep: Object.fromEntries(dependencyEntries),
      ...(dependencyContentEntries.length > 0
        ? { stepDependencyArtifactContentsByStep: Object.fromEntries(dependencyContentEntries) }
        : {}),
    },
  };
};

/** @deprecated use orchestrateToolStep via /api/tools/orchestrate (DDD-C-007) */
export const getStepDependencies = (
  tool: SupportedTool,
  completedArtifactsByStep: Partial<Record<ToolStep, string>>,
  step: ToolStep,
): Record<string, string> => {
  const order = toolStepOrder[tool];
  const stepIndex = order.indexOf(step);

  const entries = order
    .slice(0, Math.max(0, stepIndex))
    .map((prevStep) => [prevStep, completedArtifactsByStep[prevStep]])
    .filter((item): item is [ToolStep, string] => typeof item[1] === 'string');

  return Object.fromEntries(entries);
};
