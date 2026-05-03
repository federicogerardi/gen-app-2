import { assign, setup } from 'xstate';

export type SupportedTool = 'funnel-pages' | 'nextland';
export type ToolStep = 'optin' | 'quiz' | 'vsl' | 'landing' | 'thank_you';
export type ToolStepStatus = 'idle' | 'running' | 'done' | 'error';

export type ToolFlowContext = {
  tool: SupportedTool;
  steps: ToolStep[];
  currentIndex: number;
  stepStatus: Record<ToolStep, ToolStepStatus>;
  retriesByStep: Record<ToolStep, number>;
  maxRetries: number;
  errorMessage: string | null;
};

type ToolFlowInput = {
  tool: SupportedTool;
  maxRetries?: number;
};

type ToolFlowEvent =
  | { type: 'START' }
  | { type: 'STEP_DONE'; step: ToolStep }
  | { type: 'STEP_FAILED'; step: ToolStep; message: string }
  | { type: 'RETRY_STEP' }
  | { type: 'RESET' };

export const toolStepOrder: Record<SupportedTool, ToolStep[]> = {
  'funnel-pages': ['optin', 'quiz', 'vsl'],
  nextland: ['landing', 'thank_you'],
};

const initialStatus: Record<ToolStep, ToolStepStatus> = {
  optin: 'idle',
  quiz: 'idle',
  vsl: 'idle',
  landing: 'idle',
  thank_you: 'idle',
};

const initialRetries: Record<ToolStep, number> = {
  optin: 0,
  quiz: 0,
  vsl: 0,
  landing: 0,
  thank_you: 0,
};

export const toolFlowMachine = setup({
  types: {
    context: {} as ToolFlowContext,
    events: {} as ToolFlowEvent,
    input: {} as ToolFlowInput,
  },
  guards: {
    isCurrentStepEvent: ({ context, event }) => {
      if (event.type !== 'STEP_DONE' && event.type !== 'STEP_FAILED') {
        return false;
      }

      return event.step === context.steps[context.currentIndex];
    },
    hasNextStep: ({ context }) => context.currentIndex < context.steps.length - 1,
    canRetryCurrentStep: ({ context }) => {
      const currentStep = context.steps[context.currentIndex];
      if (!currentStep) {
        return false;
      }

      return context.retriesByStep[currentStep] < context.maxRetries;
    },
  },
  actions: {
    setCurrentStepRunning: assign({
      stepStatus: ({ context }) => {
        const current = context.steps[context.currentIndex];
        if (!current) {
          return context.stepStatus;
        }

        return {
          ...context.stepStatus,
          [current]: 'running',
        };
      },
      errorMessage: () => null,
    }),
    advanceToNextStep: assign({
      currentIndex: ({ context }) => context.currentIndex + 1,
      stepStatus: ({ context, event }) => {
        if (event.type !== 'STEP_DONE') {
          return context.stepStatus;
        }

        const nextIndex = context.currentIndex + 1;
        const nextStep = context.steps[nextIndex];

        return {
          ...context.stepStatus,
          [event.step]: 'done',
          ...(nextStep ? { [nextStep]: 'running' } : {}),
        };
      },
      errorMessage: () => null,
    }),
    markCurrentDone: assign({
      stepStatus: ({ context, event }) => {
        if (event.type !== 'STEP_DONE') {
          return context.stepStatus;
        }

        return {
          ...context.stepStatus,
          [event.step]: 'done',
        };
      },
      errorMessage: () => null,
    }),
    markStepFailed: assign({
      stepStatus: ({ context, event }) => {
        if (event.type !== 'STEP_FAILED') {
          return context.stepStatus;
        }

        return {
          ...context.stepStatus,
          [event.step]: 'error',
        };
      },
      retriesByStep: ({ context, event }) => {
        if (event.type !== 'STEP_FAILED') {
          return context.retriesByStep;
        }

        return {
          ...context.retriesByStep,
          [event.step]: context.retriesByStep[event.step] + 1,
        };
      },
      errorMessage: ({ event }) => (event.type === 'STEP_FAILED' ? event.message : null),
    }),
    resetFlow: assign(({ context }) => ({
      ...context,
      currentIndex: 0,
      stepStatus: {
        ...initialStatus,
      },
      retriesByStep: {
        ...initialRetries,
      },
      errorMessage: null,
    })),
  },
}).createMachine({
  id: 'toolFlowMachine',
  context: ({ input }) => ({
    tool: input.tool,
    steps: toolStepOrder[input.tool],
    currentIndex: 0,
    stepStatus: {
      ...initialStatus,
    },
    retriesByStep: {
      ...initialRetries,
    },
    maxRetries: input.maxRetries ?? 3,
    errorMessage: null,
  }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        START: {
          target: 'running',
          actions: 'setCurrentStepRunning',
        },
        RESET: {
          actions: 'resetFlow',
        },
      },
    },
    running: {
      on: {
        STEP_DONE: [
          {
            guard: ({ context, event }) => {
              if (event.type !== 'STEP_DONE') {
                return false;
              }

              return event.step === context.steps[context.currentIndex] && context.currentIndex < context.steps.length - 1;
            },
            target: 'running',
            actions: 'advanceToNextStep',
          },
          {
            guard: ({ context, event }) => event.type === 'STEP_DONE' && event.step === context.steps[context.currentIndex],
            target: 'done',
            actions: 'markCurrentDone',
          },
        ],
        STEP_FAILED: {
          guard: 'isCurrentStepEvent',
          target: 'error',
          actions: 'markStepFailed',
        },
        RESET: {
          target: 'idle',
          actions: 'resetFlow',
        },
      },
    },
    error: {
      on: {
        RETRY_STEP: [
          {
            guard: 'canRetryCurrentStep',
            target: 'running',
            actions: 'setCurrentStepRunning',
          },
          {
            target: 'failed',
          },
        ],
        RESET: {
          target: 'idle',
          actions: 'resetFlow',
        },
      },
    },
    failed: {
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetFlow',
        },
      },
    },
    done: {
      type: 'final',
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetFlow',
        },
      },
    },
  },
});
