/**
 * @deprecated This file re-exports canonical types from `../../generation/ui/tool-ux-state`.
 * Import directly from `../../generation/ui/tool-ux-state` for new code.
 *
 * This file retains only the legacy deprecated `deriveCanonicalToolUiState` overload
 * (old-style input) and its associated types, which are kept for backward compatibility
 * until `useToolForm.ts` is fully migrated to `toolPageMachine`.
 */

import type { ToolStep, SupportedTool, ToolStepStatus } from '../machines/tool-flow.machine';
import { getToolFormConfig } from './tool-form-architecture';

export type {
  CanonicalToolUiState,
  PrimaryActionPolicy,
  SecondaryActionFlags,
} from '../../generation/ui/tool-ux-state';

export { derivePrimaryActionLabel } from '../../generation/ui/tool-ux-state';

/**
 * Input parameters for deriving canonical UI state
 * @deprecated The canonical source is `toolPageMachine.context.viewModel`.
 * Keep this type only for compatibility with legacy tests and adapters.
 */
export type ToolUiDerivationInput = {
  toolKey: SupportedTool;
  intent?: 'new' | 'resume' | 'regenerate';
  projectId: string;
  briefingFile: File | null;
  briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
  isGenerationStreamActive: boolean;
  completedSteps: Set<ToolStep>;
  currentRunningStep: ToolStep | null;
  hasCompletedPreviousGeneration: boolean;
  lastCheckpointStep: ToolStep | null;
  nextAvailableStep: ToolStep | null;
  generationError: string | null;
  hasStartedCurrentRun?: boolean;
};

/**
 * Complete UI derivation output
 * All data needed to drive the unified ToolPageTemplate UI
 * @deprecated The canonical source is `toolPageMachine.context.viewModel`.
 */
export type ToolUiDerivationOutput = {
  canonicalState: CanonicalToolUiState;
  primaryActionPolicy: PrimaryActionPolicy;
  secondaryActions: SecondaryActionFlags;
  
  // Derived feedback messages (empty if default UI message applies)
  statusMessage: string | null;
  errorMessage: string | null;
  
  // Step metadata for each step card
  stepStatuses: Record<ToolStep, ToolStepStatus>;
};

/**
 * Derive canonical UI state from input conditions
 * @deprecated Use `toolPageMachine.context.viewModel` for canonical state/policy.
 * 
 * @example
 * ```ts
 * const output = deriveCanonicalToolUiState({
 *   toolKey: 'funnel-pages',
 *   projectId: 'proj-123',
 *   briefingFile: null,
 *   briefingStatus: 'idle',
 *   isGenerationStreamActive: false,
 *   completedSteps: new Set(['optin']),
 *   currentRunningStep: null,
 *   hasCompletedPreviousGeneration: true,
 *   lastCheckpointStep: 'optin',
 *   nextAvailableStep: 'quiz',
 *   generationError: null,
 * });
 * // output.canonicalState === 'prefilled-regenerate'
 * // output.primaryActionPolicy === 'regenerate-current-step'
 * ```
 */
export const deriveCanonicalToolUiState = (input: ToolUiDerivationInput): ToolUiDerivationOutput => {
  const config = getToolFormConfig(input.toolKey);

  // Determine primary canonical state
  let canonicalState: CanonicalToolUiState;
  let primaryActionPolicy: PrimaryActionPolicy;
  let statusMessage: string | null = null;
  let errorMessage: string | null = null;

  // 1. Handle active generation stream
  if (input.isGenerationStreamActive && input.currentRunningStep) {
    canonicalState = 'running';
    primaryActionPolicy = 'disabled';
    statusMessage = null;
  }

  // 2. Handle generation error recovery
  else if (input.generationError) {
    canonicalState = 'paused-with-checkpoint';
    primaryActionPolicy = 'resume-checkpoint';
    errorMessage = input.generationError;
    statusMessage = 'Generazione in pausa per un errore';
  }

  // 3. Handle briefing upload in progress
  else if (input.briefingStatus === 'uploading' || input.briefingStatus === 'extracting') {
    canonicalState = 'processing-briefing';
    primaryActionPolicy = 'disabled';
    statusMessage = `Brief in ${input.briefingStatus === 'uploading' ? 'caricamento' : 'estrazione'}...`;
  }

  // 4. Handle restored regenerate context before a new run starts
  else if (
    input.intent === 'regenerate'
    && !input.hasStartedCurrentRun
    && input.hasCompletedPreviousGeneration
    && input.briefingStatus === 'ready'
  ) {
    canonicalState = 'prefilled-regenerate';
    primaryActionPolicy = 'regenerate-current-step';
    statusMessage = 'Pronto per rigenerare con i nuovi parametri';
  }

  // 5. Handle completed workflow (no next step available)
  else if (input.nextAvailableStep === null && input.completedSteps.size > 0) {
    canonicalState = 'completed';
    primaryActionPolicy = 'open-last-artifact';
    statusMessage = 'Tutti gli artefatti sono stati generati';
  }

  // 6. Handle resume from checkpoint
  else if (input.lastCheckpointStep && input.nextAvailableStep) {
    canonicalState = 'paused-with-checkpoint';
    primaryActionPolicy = 'resume-checkpoint';
    statusMessage = `Puoi riprendere dallo step: ${input.lastCheckpointStep}`;
  }

  // 7. Handle form ready: project selected, briefing uploaded, next step available
  else if (
    input.projectId.trim().length > 0
    && input.briefingStatus === 'ready'
    && input.nextAvailableStep
  ) {
    canonicalState = 'draft-ready';
    primaryActionPolicy = 'start-generation';
    statusMessage = 'Pronto per la generazione';
  }

  // 8. Handle regeneration scenario (previous generation exists, can restart)
  else if (
    input.hasCompletedPreviousGeneration
    && input.briefingStatus === 'ready'
    && input.completedSteps.size === 0
  ) {
    canonicalState = 'prefilled-regenerate';
    primaryActionPolicy = 'regenerate-current-step';
    statusMessage = 'Pronto per rigenerare con i nuovi parametri';
  }

  // 9. Default: form empty
  else {
    canonicalState = 'draft-empty';
    primaryActionPolicy = 'disabled';
    statusMessage = 'Seleziona un progetto e carica un brief per iniziare';
  }

  // Derive secondary action flags
  const secondaryActions: SecondaryActionFlags = {
    canRetry: canonicalState === 'paused-with-checkpoint' || canonicalState === 'completed',
    canSkipStep: input.nextAvailableStep !== null && canonicalState === 'draft-ready',
    canCancelGeneration: input.isGenerationStreamActive,
    canOpenPreviousArtifact: input.completedSteps.size > 0,
  };

  // Build step statuses for each step card
  const stepStatuses = Object.fromEntries(
    config.steps.map(step => {
      let status: ToolStepStatus = 'idle';

      if (input.isGenerationStreamActive && input.currentRunningStep === step) {
        status = 'running';
      } else if (input.completedSteps.has(step)) {
        status = 'done';
      }
      // Note: 'error' status would be set if we had per-step error tracking

      return [step, status];
    }),
  ) as Record<ToolStep, ToolStepStatus>;

  return {
    canonicalState,
    primaryActionPolicy,
    secondaryActions,
    statusMessage,
    errorMessage,
    stepStatuses,
  };
};

