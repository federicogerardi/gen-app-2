import { assign, setup } from 'xstate';
import { mergeAcquisitionIntoGenerationInput } from './generation/context-generation-assembly';
import { createComponentLogger, LogComponent } from '../runtime/log-components';

const glog = createComponentLogger(LogComponent.GEOMETRIC);

import type {
  ToolWorkflowEvent,
  ToolWorkflowInput,
  WorkflowStepCompletedEvent,
  WorkflowStepState,
  WorkflowStepUnlockedEvent,
} from '../types/xstate';

type ToolWorkflowMachineContext = {
  input: ToolWorkflowInput;
  stepStates: WorkflowStepState[];
  activeStepIndex: number;
  currentArtifactId: string;
  lastUnlockedStep: string | null;
  assembledGenerationInput: Record<string, unknown>;
};

type ToolWorkflowMachineInput = ToolWorkflowInput;

type ToolWorkflowMachineEvent =
  | { type: 'STEP_START'; stepKey: string }
  | { type: 'STEP_SUCCESS'; stepKey: string; output: unknown; artifactId: string }
  | { type: 'STEP_FAILURE'; stepKey: string; reason: string }
  | { type: 'STEP_RETRY'; stepKey: string }
  | { type: 'STEP_SKIP'; stepKey: string }
  | { type: 'WORKFLOW_COMPLETE' };

const nowIso = (): string => new Date().toISOString();

const createInitialStepStates = (input: ToolWorkflowInput): WorkflowStepState[] => {
  const completedSet = new Set(
    input.bootstrap?.completedSteps?.map((s) => s.stepKey) ?? [],
  );

  if (input.bootstrap?.stepKey) {
    completedSet.add(input.bootstrap.stepKey);
  }

  return input.steps.map((step) => ({
    key: step.key,
    status: completedSet.has(step.key) ? 'done' : 'idle',
    retryCount: 0,
    errorMessage: null,
  }));
};

const findFirstNonTerminalStepIndex = (stepStates: WorkflowStepState[]): number =>
  stepStates.findIndex((step) => step.status === 'idle' || step.status === 'running' || step.status === 'error');

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseAcquisitionOutput = (output: unknown): unknown => {
  if (typeof output === 'string') {
    try {
      return JSON.parse(output) as unknown;
    } catch {
      return null;
    }
  }

  if (isPlainRecord(output)) {
    const eventType = output.type;
    const payload = output.payload;

    if (eventType === 'ACQUISITION_COMPLETED' && isPlainRecord(payload)) {
      return payload;
    }

    return output;
  }

  return null;
};

export const toolWorkflowMachine = setup({
  types: {
    context: {} as ToolWorkflowMachineContext,
    input: {} as ToolWorkflowMachineInput,
    events: {} as ToolWorkflowMachineEvent,
    output: {} as ToolWorkflowEvent,
  },
  guards: {
    hasRemainingSteps: ({ context }) => findFirstNonTerminalStepIndex(context.stepStates) !== -1,
    allRequiredStepsCompleted: ({ context }) =>
      context.stepStates.every((step) =>
        step.status === 'done' || step.status === 'skipped' || context.input.steps.find((s) => s.key === step.key)?.optional,
      ),
    dependenciesSatisfied: ({ context, event }) => {
      if (!('stepKey' in event)) {
        return false;
      }
      const required = context.input.dependencyGraph[event.stepKey] ?? [];
      return required.every((dependencyKey) =>
        context.stepStates.some((step) => step.key === dependencyKey && step.status === 'done'),
      );
    },
  },
  actions: {
    markStepRunning: assign({
      stepStates: ({ context, event }) => {
        if (event.type !== 'STEP_START') {
          return context.stepStates;
        }
        return context.stepStates.map((step) =>
          step.key === event.stepKey ? { ...step, status: 'running', errorMessage: null } : step,
        );
      },
    }),
    markStepDone: assign({
      stepStates: ({ context, event }) => {
        if (event.type !== 'STEP_SUCCESS') {
          return context.stepStates;
        }
        return context.stepStates.map((step) =>
          step.key === event.stepKey
            ? { ...step, status: 'done', errorMessage: null }
            : step,
        );
      },
      currentArtifactId: ({ context, event }) =>
        event.type === 'STEP_SUCCESS' ? event.artifactId : context.currentArtifactId,
    }),
    markStepError: assign({
      stepStates: ({ context, event }) => {
        if (event.type !== 'STEP_FAILURE') {
          return context.stepStates;
        }
        return context.stepStates.map((step) =>
          step.key === event.stepKey
            ? {
              ...step,
              status: 'error',
              retryCount: step.retryCount + 1,
              errorMessage: event.reason,
            }
            : step,
        );
      },
    }),
    markStepSkipped: assign({
      stepStates: ({ context, event }) => {
        if (event.type !== 'STEP_SKIP') {
          return context.stepStates;
        }
        return context.stepStates.map((step) =>
          step.key === event.stepKey ? { ...step, status: 'skipped', errorMessage: null } : step,
        );
      },
    }),
    syncActiveStepIndex: assign({
      activeStepIndex: ({ context }) => {
        const next = findFirstNonTerminalStepIndex(context.stepStates);
        return next === -1 ? context.activeStepIndex : next;
      },
    }),
    cacheUnlockedStep: assign({
      lastUnlockedStep: ({ event }) => ('stepKey' in event ? event.stepKey : null),
    }),
    mergeAcquisitionOutput: assign({
      assembledGenerationInput: ({ context, event }) => {
        if (event.type !== 'STEP_SUCCESS') {
          return context.assembledGenerationInput;
        }

        const stepDescriptor = context.input.steps.find((step) => step.key === event.stepKey);
        if (stepDescriptor?.type !== 'acquisition') {
          return context.assembledGenerationInput;
        }

        const acquisitionOutput = parseAcquisitionOutput(event.output);
        return mergeAcquisitionIntoGenerationInput(context.assembledGenerationInput, acquisitionOutput);
      },
    }),
    mergeCrawlingOutput: assign({
      assembledGenerationInput: ({ context, event }) => {
        if (event.type !== 'STEP_SUCCESS') {
          return context.assembledGenerationInput;
        }

        const stepDescriptor = context.input.steps.find((step) => step.key === event.stepKey);
        if (stepDescriptor?.type !== 'crawling') {
          return context.assembledGenerationInput;
        }

        const crawlingOutput = event.output as { crawlArtifacts?: { content: string; structuredPayload: Record<string, unknown> }[] } | undefined;
        if (!crawlingOutput?.crawlArtifacts?.length) {
          glog.error({ requestId: context.input.requestId ?? 'unknown', operation: 'mergeCrawlingOutput', stepKey: event.stepKey }, 'merge.crawling.empty');
          return context.assembledGenerationInput;
        }

        const mergedSnippets = crawlingOutput.crawlArtifacts.map((a) => a.content).filter(Boolean).join('\n\n');

        const mergedSources: Array<Record<string, unknown>> = [];
        const mergedPaaQueries: string[] = [];
        const seenPaaQueries = new Set<string>();

        for (const artifact of crawlingOutput.crawlArtifacts) {
          const payload = artifact.structuredPayload;
          if (Array.isArray(payload.sources)) {
            mergedSources.push(...payload.sources);
          }
          if (Array.isArray(payload.paaQueries)) {
            for (const q of payload.paaQueries) {
              if (typeof q === 'string' && !seenPaaQueries.has(q)) {
                seenPaaQueries.add(q);
                mergedPaaQueries.push(q);
              }
            }
          }
        }

        glog.info({ requestId: context.input.requestId ?? 'unknown', operation: 'mergeCrawlingOutput', stepKey: event.stepKey, sourceCount: mergedSources.length, paaCount: mergedPaaQueries.length, snippetLength: mergedSnippets.length }, 'merge.crawling.completed');

        const result: Record<string, unknown> = {
          ...context.assembledGenerationInput,
          crawling: {
            snippets: mergedSnippets,
            sources: mergedSources,
            paaQueries: mergedPaaQueries,
          },
        };

        // Preserve brandName if present in request input
        const requestInput = context.input.requestInput as Record<string, unknown> | undefined;
        const brandName = typeof requestInput?.brandName === 'string' ? requestInput.brandName : '';
        if (brandName) {
          result.brandName = brandName;
        }

        return result;
      },
    }),
    mergeScoringOutput: assign({
      assembledGenerationInput: ({ context, event }) => {
        if (event.type !== 'STEP_SUCCESS') {
          return context.assembledGenerationInput;
        }

        const stepDescriptor = context.input.steps.find((step) => step.key === event.stepKey);
        if (stepDescriptor?.type !== 'scoring') {
          return context.assembledGenerationInput;
        }

        const scoringOutput = event.output as { ranking?: Record<string, unknown> } | undefined;
        if (!scoringOutput?.ranking) {
          glog.error({ requestId: context.input.requestId ?? 'unknown', operation: 'mergeScoringOutput', stepKey: event.stepKey }, 'merge.scoring.empty');
          return context.assembledGenerationInput;
        }

        const competitorCount = Object.keys(scoringOutput.ranking).length;
        glog.info({ requestId: context.input.requestId ?? 'unknown', operation: 'mergeScoringOutput', stepKey: event.stepKey, competitorCount }, 'merge.scoring.completed');

        return {
          ...context.assembledGenerationInput,
          scoring: scoringOutput.ranking,
        };
      },
    }),
  },
}).createMachine({
  id: 'toolWorkflowMachine',
  initial: 'running',
  context: ({ input }) => {
    const stepStates = createInitialStepStates(input);
    return {
      input,
      stepStates,
      activeStepIndex: Math.max(findFirstNonTerminalStepIndex(stepStates), 0),
      currentArtifactId: input.bootstrap?.artifactId ?? '',
      lastUnlockedStep: input.bootstrap?.stepKey ?? null,
      assembledGenerationInput: {},
    };
  },
  states: {
    running: {
      on: {
        STEP_START: {
          guard: 'dependenciesSatisfied',
          actions: ['cacheUnlockedStep', 'markStepRunning', 'syncActiveStepIndex'],
        },
        STEP_SUCCESS: {
          actions: ['markStepDone', 'mergeAcquisitionOutput', 'mergeCrawlingOutput', 'mergeScoringOutput', 'syncActiveStepIndex'],
        },
        STEP_FAILURE: {
          target: 'error',
          actions: ['markStepError', 'syncActiveStepIndex'],
        },
        STEP_SKIP: {
          actions: ['markStepSkipped', 'syncActiveStepIndex'],
        },
        WORKFLOW_COMPLETE: {
          target: 'done',
          guard: 'allRequiredStepsCompleted',
        },
      },
      always: [
        {
          guard: 'allRequiredStepsCompleted',
          target: 'done',
        },
      ],
    },
    error: {
      on: {
        STEP_RETRY: {
          target: 'running',
          reenter: true,
        },
      },
    },
    done: {
      type: 'final',
      output: ({ context }) => {
        const stepKey =
          context.lastUnlockedStep ?? context.input.steps[context.input.steps.length - 1]?.key ?? 'workflow';
        const unlockedEvent: WorkflowStepUnlockedEvent = {
          type: 'WORKFLOW_STEP_UNLOCKED',
          requestId: context.input.requestId,
          sourceActor: 'toolWorkflowMachine',
          timestamp: nowIso(),
          stepKey,
        };
        const completedEvent: WorkflowStepCompletedEvent = {
          type: 'WORKFLOW_STEP_COMPLETED',
          requestId: context.input.requestId,
          sourceActor: 'toolWorkflowMachine',
          timestamp: nowIso(),
          stepKey,
          artifactId: context.currentArtifactId || context.input.requestId,
        };

        return context.currentArtifactId ? completedEvent : unlockedEvent;
      },
    },
  },
});
