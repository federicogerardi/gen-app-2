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
