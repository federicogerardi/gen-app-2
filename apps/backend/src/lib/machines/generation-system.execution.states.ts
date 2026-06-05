import {
  getAcquisitionResultParams,
  getExtractionResultParams,
  getGenerateResultParams,
  getInvokeFailureReason,
  getStreamResultParams,
  getToolDoneOutput,
} from './generation-system.events';
import type { GenerationMachineContext } from './generation-system.types';
import {
  getRegistrySelector,
  resolveRequestScopedStepDescriptor,
  resolveToolWorkflowPlan,
  resolveWorkflowRunMode,
} from './generation-routing';

type ContextArgs = {
  context: GenerationMachineContext;
};

type UnknownEventArgs = {
  event: unknown;
};

export const generationSystemExecutionStates = {
  extractionFlow: {
    entry: ['ensureArtifactId'],
    invoke: {
      id: 'extractionActor',
      src: 'invokeExtraction',
      input: ({ context }: ContextArgs) => ({ context }),
      onDone: [
        {
          guard: 'extractionOutputIsAccepted',
          target: 'dispatchingMode',
          actions: {
            type: 'cacheExtractionResult',
            params: ({ event }: UnknownEventArgs) => getExtractionResultParams(event),
          },
        },
        {
          target: 'resolvingFallbackPolicy',
          actions: {
            type: 'queueFallbackDecision',
            params: ({ event }: UnknownEventArgs) => ({
              reason: getInvokeFailureReason(event),
              defaultReason: 'extraction_failed',
            }),
          },
        },
      ],
      onError: {
        target: 'resolvingFallbackPolicy',
        actions: {
          type: 'queueFallbackDecision',
          params: {
            defaultReason: 'extraction_failed',
          },
        },
      },
    },
  },
  toolGenerationFlow: {
    entry: ['ensureArtifactId'],
    always: [
      {
        guard: ({ context }: ContextArgs) =>
          resolveWorkflowRunMode(context) === 'new' && context.routeType === 'tool',
        target: 'acquiringContext',
      },
      {
        guard: ({ context }: ContextArgs) => resolveWorkflowRunMode(context) === 'new',
        target: 'dispatchingMode',
      },
    ],
    invoke: {
      id: 'toolActor',
      src: 'invokeToolWorkflow',
      input: ({ context }: ContextArgs) => {
        const plan = resolveToolWorkflowPlan(context);
        const stepDescriptor = resolveRequestScopedStepDescriptor(context, plan);
        const runMode = resolveWorkflowRunMode(context);

        return {
          requestId: context.requestId,
          toolKey: plan?.toolKey ?? context.toolKey ?? 'workflow',
          workflowType: context.workflowType ?? 'generic',
          runMode,
          steps: [stepDescriptor],
          dependencyGraph: {
            [stepDescriptor.key]: plan?.dependencyGraph[stepDescriptor.key] ?? stepDescriptor.dependencies,
          },
          ...(runMode === 'new' ? {} : {
            bootstrap: {
              stepKey: stepDescriptor.key,
              output: context.syntheticResponse,
              artifactId: context.artifactId ?? context.artifactIdFactory(),
            },
          }),
          ...getRegistrySelector(context),
        };
      },
      onDone: [
        {
          guard: 'toolOutputIsCompleted',
          target: 'dispatchingMode',
          actions: {
            type: 'cacheToolArtifactFromOutput',
            params: ({ event }: UnknownEventArgs) => {
              const output = getToolDoneOutput(event);
              return {
                artifactId: output?.type === 'WORKFLOW_STEP_COMPLETED' ? output.artifactId : null,
              };
            },
          },
        },
        {
          target: 'dispatchingMode',
        },
      ],
      onError: {
        target: 'resolvingFallbackPolicy',
        actions: {
          type: 'queueFallbackDecision',
          params: {
            defaultReason: 'workflow_failed',
          },
        },
      },
    },
  },
  acquiringContext: {
    invoke: {
      id: 'acquisitionActor',
      src: 'invokeApiAcquisition',
      input: ({ context }: ContextArgs) => ({ context }),
      onDone: [
        {
          guard: 'acquisitionOutputIsAccepted',
          target: 'dispatchingMode',
          actions: {
            type: 'cacheAcquisitionResult',
            params: ({ event }: UnknownEventArgs) => getAcquisitionResultParams(event),
          },
        },
        {
          target: 'dispatchingMode',
        },
      ],
      onError: {
        target: 'resolvingFallbackPolicy',
        actions: {
          type: 'queueFallbackDecision',
          params: {
            defaultReason: 'acquisition_failed',
          },
        },
      },
    },
  },
  genericGenerationFlow: {
    always: 'dispatchingMode',
  },
  dispatchingMode: {
    always: [
      {
        guard: 'modeIsGenerate',
        target: 'generating',
      },
      { target: 'streaming' },
    ],
  },
  generating: {
    entry: ['ensureArtifactId'],
    invoke: {
      id: 'generationActor',
      src: 'invokeGeneration',
      input: ({ context }: ContextArgs) => ({ context }),
      onDone: [
        {
          guard: 'generateOutputIsFailure',
          target: 'resolvingFallbackPolicy',
          actions: [
            {
              type: 'cacheGenerateResult',
              params: ({ event }: UnknownEventArgs) => getGenerateResultParams(event),
            },
            {
              type: 'queueFallbackDecision',
              params: ({ event }: UnknownEventArgs) => ({
                reason: getInvokeFailureReason(event),
                defaultReason: 'generate_failure',
              }),
            },
          ],
        },
        {
          target: 'persistingSuccessSync',
          actions: {
            type: 'cacheGenerateResult',
            params: ({ event }: UnknownEventArgs) => getGenerateResultParams(event),
          },
        },
      ],
      onError: {
        target: 'resolvingFallbackPolicy',
        actions: {
          type: 'queueFallbackDecision',
          params: { defaultReason: 'generate_failure' },
        },
      },
    },
  },
  streaming: {
    entry: ['ensureArtifactId'],
    invoke: {
      id: 'streamActor',
      src: 'invokeStream',
      input: ({ context }: ContextArgs) => ({
        requestId: context.requestId,
        artifactId: context.artifactId ?? context.artifactIdFactory(),
        model: context.model,
        requestInput: context.requestInput,
        workflowType: context.workflowType,
        outputFormat: context.outputFormat,
        runtime: {
          now: context.runtimeNow,
        },
        ...getRegistrySelector(context),
        adapters: {
          stream: context.adapters.stream,
          llm: context.adapters.llm,
        },
      }),
      onDone: [
        {
          guard: 'streamOutputIsFailure',
          target: 'resolvingFallbackPolicy',
          actions: [
            {
              type: 'cacheStreamResult',
              params: ({ event }: UnknownEventArgs) => getStreamResultParams(event),
            },
            {
              type: 'queueFallbackDecision',
              params: ({ event }: UnknownEventArgs) => ({
                reason: getInvokeFailureReason(event),
                defaultReason: 'stream_failure',
              }),
            },
          ],
        },
        {
          guard: 'streamOutputIsEmptySuccess',
          target: 'resolvingFallbackPolicy',
          actions: [
            {
              type: 'cacheStreamResult',
              params: ({ event }: UnknownEventArgs) => getStreamResultParams(event),
            },
            {
              type: 'queueFallbackDecision',
              params: {
                reason: 'stream_empty_output',
                defaultReason: 'stream_empty_output',
              },
            },
          ],
        },
        {
          target: 'persistingSuccess',
          actions: {
            type: 'cacheStreamResult',
            params: ({ event }: UnknownEventArgs) => getStreamResultParams(event),
          },
        },
      ],
      onError: {
        target: 'resolvingFallbackPolicy',
        actions: {
          type: 'queueFallbackDecision',
          params: {
            defaultReason: 'stream_failure',
          },
        },
      },
    },
  },
} as const;