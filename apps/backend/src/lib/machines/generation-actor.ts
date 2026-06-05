import { fromPromise } from 'xstate';

import type { LlmUsageMetrics } from '../adapters/generation.adapters';
import type { GenerationMachineContext } from './generation-system.types';

export type GenerateDoneOutput =
  | { type: 'GENERATE_TERMINATED_SUCCESS'; content: string; metrics?: LlmUsageMetrics }
  | { type: 'GENERATE_TERMINATED_FAILURE'; reason: string };

export const generationActor = fromPromise(
  async ({ input }: { input: { context: GenerationMachineContext } }): Promise<GenerateDoneOutput> => {
    const { context } = input;

    const result = await context.adapters.generate.generateText({
      requestId: context.requestId,
      model: context.model,
      requestInput: context.requestInput,
    });

    if (!result.content || result.content.length === 0) {
      return {
        type: 'GENERATE_TERMINATED_FAILURE',
        reason: 'generate_empty_output',
      };
    }

    return {
      type: 'GENERATE_TERMINATED_SUCCESS',
      content: result.content,
      ...(result.usage ? { metrics: result.usage } : {}),
    };
  },
);