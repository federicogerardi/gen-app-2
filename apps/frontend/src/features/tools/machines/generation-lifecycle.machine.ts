import { assign, setup } from 'xstate';
import { toolStepOrder, type SupportedTool, type ToolStep } from './tool-flow.machine';

type GenerationLifecycleInput = {
  toolKey: SupportedTool;
  maxRetries?: number;
};

type GenerationLifecycleEvent =
  | { type: 'STEP_DONE'; step: ToolStep }
  | { type: 'STEP_FAILED'; step: ToolStep; message: string }
  | { type: 'RETRY_STEP' }
  | { type: 'CANCEL' };

type GenerationLifecycleContext = {
  toolKey: SupportedTool;
  steps: readonly ToolStep[];
  currentIndex: number;
  maxRetries: number;
  retriesByStep: Partial<Record<ToolStep, number>>;
  error: string | null;
};

export type GenerationLifecycleOutput =
  | { status: 'completed' }
  | { status: 'cancelled' }
  | { status: 'failed'; error: string };

const isCurrentStep = (context: GenerationLifecycleContext, step: ToolStep) => context.steps[context.currentIndex] === step;

export const generationLifecycleMachine = setup({
  types: {
    context: {} as GenerationLifecycleContext,
    input: {} as GenerationLifecycleInput,
    events: {} as GenerationLifecycleEvent,
    output: {} as GenerationLifecycleOutput,
  },
  guards: {
    isCurrentStepDone: ({ context, event }) => event.type === 'STEP_DONE' && isCurrentStep(context, event.step),
    hasNextStep: ({ context }) => context.currentIndex < context.steps.length - 1,
    canRetryCurrentStep: ({ context }) => {
      const currentStep = context.steps[context.currentIndex];
      return currentStep ? (context.retriesByStep[currentStep] ?? 0) < context.maxRetries : false;
    },
  },
  actions: {
    advanceStep: assign({
      currentIndex: ({ context }) => context.currentIndex + 1,
      error: () => null,
    }),
    setFailedState: assign({
      retriesByStep: ({ context, event }) => {
        if (event.type !== 'STEP_FAILED') {
          return context.retriesByStep;
        }
        return {
          ...context.retriesByStep,
          [event.step]: (context.retriesByStep[event.step] ?? 0) + 1,
        };
      },
      error: ({ event }) => (event.type === 'STEP_FAILED' ? event.message : 'Tool flow failed'),
    }),
    clearError: assign({
      error: () => null,
    }),
  },
}).createMachine({
  id: 'generationLifecycleMachine',
  context: ({ input }) => ({
    toolKey: input.toolKey,
    steps: toolStepOrder[input.toolKey],
    currentIndex: 0,
    maxRetries: input.maxRetries ?? 3,
    retriesByStep: {},
    error: null,
  }),
  initial: 'running',
  states: {
    running: {
      on: {
        STEP_DONE: [
          {
            guard: ({ context, event }) => event.type === 'STEP_DONE' && isCurrentStep(context, event.step) && context.currentIndex < context.steps.length - 1,
            actions: 'advanceStep',
          },
          {
            guard: 'isCurrentStepDone',
            target: 'completed',
            actions: 'clearError',
          },
        ],
        STEP_FAILED: {
          target: 'failed',
          actions: 'setFailedState',
        },
        CANCEL: {
          target: 'cancelled',
        },
      },
    },
    failed: {
      on: {
        RETRY_STEP: [
          {
            guard: 'canRetryCurrentStep',
            target: 'running',
            actions: 'clearError',
          },
          {
            target: 'failedTerminal',
          },
        ],
        CANCEL: {
          target: 'cancelled',
        },
      },
    },
    completed: {
      type: 'final',
      output: { status: 'completed' },
    },
    cancelled: {
      type: 'final',
      output: { status: 'cancelled' },
    },
    failedTerminal: {
      type: 'final',
      output: ({ context }) => ({
        status: 'failed',
        error: context.error ?? 'Tool flow failed',
      }),
    },
  },
});