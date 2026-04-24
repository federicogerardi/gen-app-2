import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import type { SupportedTool, ToolStep } from '../machines/tool-flow.machine';

export const toolStepOrder: Record<SupportedTool, ToolStep[]> = {
  'funnel-pages': ['optin', 'quiz', 'vsl'],
  nextland: ['landing', 'thank_you'],
};

export const createStepRequest = (
  baseRequest: GenerationRequest,
  tool: SupportedTool,
  step: ToolStep,
  dependencies: Record<string, string>,
): GenerationRequest => {
  return {
    ...baseRequest,
    requestId: `${baseRequest.requestId}:${step}`,
    toolKey: tool,
    workflowType: tool,
    input: {
      ...baseRequest.input,
      step,
      stepDependencyArtifactIds: dependencies,
    },
  };
};

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
