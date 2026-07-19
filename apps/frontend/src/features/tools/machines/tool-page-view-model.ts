import { toolStepOrder } from '../runtime/tool-generation-engine';
import { appCopy } from '../../../app/copy/system';
import type {
  CanonicalToolUiState,
  PrimaryActionPolicy,
  SecondaryActionFlags,
} from '../../generation/ui/tool-ux-state';
import type { SupportedTool, ToolStep, ToolStepStatus } from './tool-flow.machine';
import type { ToolPageProgressState } from './tool-page-progress';
import type { ReadinessSnapshot } from './tool-page-readiness';

export type ToolPageViewModel = {
  readiness: ReadinessSnapshot;
  canonicalState: CanonicalToolUiState;
  primaryActionPolicy: PrimaryActionPolicy;
  secondaryActionFlags: SecondaryActionFlags;
  stepStatuses: Record<ToolStep, ToolStepStatus>;
  messages: {
    status: string | null;
    error: string | null;
  };
};

export const TOOL_PAGE_MESSAGES = {
  readyStatus: appCopy.ui.toolPage.statusMessages.ready,
  waitingStatus: appCopy.ui.toolPage.statusMessages.waiting,
} as const;

const buildDefaultStepStatuses = (
  toolKey: SupportedTool,
): Record<ToolStep, ToolStepStatus> => {
  const entries = toolStepOrder[toolKey].map((step) => [step, 'idle'] as const);
  return Object.fromEntries(entries) as Record<ToolStep, ToolStepStatus>;
};

export const buildDefaultViewModel = (
  toolKey: SupportedTool,
  readiness: ReadinessSnapshot,
): ToolPageViewModel => ({
  readiness,
  canonicalState: readiness.canStartFlow ? 'draft-ready' : 'draft-empty',
  primaryActionPolicy: readiness.canStartFlow ? 'start-generation' : 'disabled',
  secondaryActionFlags: {
    canRetry: false,
    canSkipStep: false,
    canCancelGeneration: false,
    canOpenPreviousArtifact: false,
  },
  stepStatuses: buildDefaultStepStatuses(toolKey),
  messages: {
    status: readiness.canStartFlow
      ? TOOL_PAGE_MESSAGES.readyStatus
      : TOOL_PAGE_MESSAGES.waitingStatus,
    error: null,
  },
});

type BuildToolPageViewModelInput = {
  toolKey: SupportedTool;
  intent?: 'new' | 'resume' | 'regenerate';
  readiness: ReadinessSnapshot;
  progress: ToolPageProgressState;
  errorMessage: string | null;
  configuringSubstate?: 'clean' | 'hydrationFailed' | 'generationFailed';
  runRequestPrefix?: string | null;
};

export const buildToolPageViewModel = ({
  toolKey,
  intent = 'new',
  readiness,
  progress,
  errorMessage,
  configuringSubstate = 'clean',
  runRequestPrefix = null,
}: BuildToolPageViewModelInput): ToolPageViewModel => {
  const defaultModel = buildDefaultViewModel(toolKey, readiness);
  const totalSteps = toolStepOrder[toolKey].length;
  const completedCount = progress.completedSteps.size;
  const hasCompletedAtLeastOneStep = completedCount > 0;
  const hasCompletedAllSteps = completedCount === totalSteps && totalSteps > 0;
  const hasCheckpoint = progress.lastCheckpointStep !== null;
  const stepStatuses = buildDefaultStepStatuses(toolKey);
  const isCurrentRunComplete = runRequestPrefix !== null && hasCompletedAllSteps;
  const hasError = configuringSubstate !== 'clean';

  for (const step of progress.completedSteps) {
    stepStatuses[step] = 'done';
  }

  if (hasError && errorMessage) {
    return {
      ...defaultModel,
      canonicalState: 'paused-with-checkpoint',
      primaryActionPolicy: 'resume-checkpoint',
      secondaryActionFlags: {
        ...defaultModel.secondaryActionFlags,
        canRetry: true,
        canOpenPreviousArtifact: hasCompletedAtLeastOneStep,
      },
      stepStatuses,
      messages: {
        status: configuringSubstate === 'generationFailed'
          ? 'Generazione in pausa per un errore'
          : 'Idratazione fallita',
        error: errorMessage,
      },
    };
  }

  if (intent === 'regenerate' && readiness.canStartFlow && !isCurrentRunComplete) {
    return {
      ...defaultModel,
      canonicalState: 'prefilled-regenerate',
      primaryActionPolicy: 'regenerate-current-step',
      secondaryActionFlags: {
        ...defaultModel.secondaryActionFlags,
        canOpenPreviousArtifact: hasCompletedAtLeastOneStep,
      },
      stepStatuses,
      messages: {
        status: 'Pronto per rigenerare con i nuovi parametri',
        error: null,
      },
    };
  }

  if (hasCompletedAllSteps) {
    return {
      ...defaultModel,
      canonicalState: 'completed',
      primaryActionPolicy: 'open-last-artifact',
      secondaryActionFlags: {
        ...defaultModel.secondaryActionFlags,
        canRetry: true,
        canOpenPreviousArtifact: true,
      },
      stepStatuses,
      messages: {
        status: 'Tutti gli artefatti sono stati generati',
        error: null,
      },
    };
  }

  if (hasCheckpoint && readiness.canStartFlow) {
    return {
      ...defaultModel,
      canonicalState: 'paused-with-checkpoint',
      primaryActionPolicy: 'resume-checkpoint',
      secondaryActionFlags: {
        ...defaultModel.secondaryActionFlags,
        canRetry: true,
        canOpenPreviousArtifact: hasCompletedAtLeastOneStep,
      },
      stepStatuses,
      messages: {
        status: `Puoi riprendere dallo step: ${progress.lastCheckpointStep}`,
        error: null,
      },
    };
  }

  return {
    ...defaultModel,
    secondaryActionFlags: {
      ...defaultModel.secondaryActionFlags,
      canOpenPreviousArtifact: hasCompletedAtLeastOneStep,
    },
    stepStatuses,
    messages: {
      ...defaultModel.messages,
      error: null,
    },
  };
};

export type ReactiveViewModelInput = {
  toolKey: SupportedTool;
  readiness: ReadinessSnapshot;
  progress: ToolPageProgressState;
  errorMessage: string | null;
  intent: 'new' | 'resume' | 'regenerate';
  runRequestPrefix: string | null;
};

export const buildReactiveViewModel = (
  context: ReactiveViewModelInput,
  configuringSubstate: 'clean' | 'hydrationFailed' | 'generationFailed' = 'clean',
): ToolPageViewModel => buildToolPageViewModel({
  toolKey: context.toolKey,
  intent: context.intent,
  readiness: context.readiness,
  progress: context.progress,
  errorMessage: context.errorMessage,
  configuringSubstate,
  runRequestPrefix: context.runRequestPrefix,
});

export const canStartFromPolicy = (policy: PrimaryActionPolicy): boolean => {
  return policy === 'start-generation' || policy === 'resume-checkpoint' || policy === 'regenerate-current-step';
};
