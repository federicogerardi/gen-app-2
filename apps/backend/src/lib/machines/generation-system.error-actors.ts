import { fromPromise } from 'xstate';
import type { GenerationErrorContext } from './generation-system.context-types';

export type ErrorActorInput = GenerationErrorContext & {
  reason: string;
  hasContent: boolean;
};

export type ErrorActorOutput =
  | { type: 'EXTRACTION_PARTIAL_RECOVERY'; recoveryReason: string }
  | { type: 'EXTRACTION_FALLBACK_TO_RAW'; fallbackReason: string }
  | { type: 'EXTRACTION_COMPLETE_FAILURE'; finalReason: string }
  | { type: 'TOOL_PARTIAL_RECOVERY'; recoveryAction: string }
  | { type: 'TOOL_DEPENDENCY_RECOVERY'; recoveryAction: string }
  | { type: 'TOOL_COMPLETE_FAILURE'; finalReason: string }
  | { type: 'GENERIC_PARTIAL_RECOVERY'; recoveryReason: string }
  | { type: 'GENERIC_COMPLETE_FAILURE'; finalReason: string };

export const extractionErrorActor = fromPromise<ErrorActorOutput, ErrorActorInput>(async ({ input }) => {
  const { reason, hasContent } = input;

  if (hasContent && reason === 'extraction_failed') {
    return {
      type: 'EXTRACTION_PARTIAL_RECOVERY',
      recoveryReason: 'content_available_despite_extraction_failure',
    };
  }

  if (reason === 'extraction_chain_exhausted') {
    return {
      type: 'EXTRACTION_FALLBACK_TO_RAW',
      fallbackReason: 'structured_extraction_unavailable',
    };
  }

  return {
    type: 'EXTRACTION_COMPLETE_FAILURE',
    finalReason: reason || 'extraction_failed',
  };
});

export const toolWorkflowErrorActor = fromPromise<ErrorActorOutput, ErrorActorInput>(async ({ input }) => {
  const { reason, hasContent, pendingFallback } = input;

  if (hasContent && reason === 'workflow_step_failed') {
    return {
      type: 'TOOL_PARTIAL_RECOVERY',
      recoveryAction: 'retry_with_reduced_complexity',
    };
  }

  if (reason === 'tool_dependency_missing') {
    return {
      type: 'TOOL_DEPENDENCY_RECOVERY',
      recoveryAction: 'skip_step_with_fallback_content',
    };
  }

  return {
    type: 'TOOL_COMPLETE_FAILURE',
    finalReason: pendingFallback?.defaultReason || 'workflow_failed',
  };
});

export const genericErrorActor = fromPromise<ErrorActorOutput, ErrorActorInput>(async ({ input }) => {
  const { reason, hasContent } = input;

  if (hasContent) {
    return {
      type: 'GENERIC_PARTIAL_RECOVERY',
      recoveryReason: 'content_partially_available',
    };
  }

  return {
    type: 'GENERIC_COMPLETE_FAILURE',
    finalReason: reason || 'generation_failed',
  };
});
