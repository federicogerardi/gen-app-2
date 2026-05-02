/**
 * Canonical UI state derivation for tool pages
 * Maps complex tool state to a single canonical state for consistent UI rendering
 * 
 * This enables:
 * - Unified feedback messages across tools
 * - Consistent CTA behavior based on state transitions
 * - Step-specific UI rendering logic
 * - Progressive enhancement from empty → processing → ready → running → completed
 */

import type { ToolStep, SupportedTool } from '../machines/tool-flow.machine';
import { getToolFormConfig } from './tool-form-architecture';

/**
 * Canonical UI states for tool generation workflow
 * Each state maps to specific UI feedback, CTAs, and form behavior
 */
export type CanonicalToolUiState =
  | 'draft-empty'                    // Initial state: form empty, briefing not uploaded
  | 'processing-briefing'            // Briefing upload/extraction in progress
  | 'draft-ready'                    // Form ready: project selected, briefing uploaded, next step available
  | 'prefilled-regenerate'           // Previous generation completed, can regenerate with same briefing
  | 'paused-with-checkpoint'         // Generation paused at a step, can resume from checkpoint
  | 'resume-needs-briefing'          // Resuming requires new briefing (e.g., different project)
  | 'running'                        // Generation stream active
  | 'completed';                     // All steps completed

/**
 * Primary action policy based on canonical state
 * Determines the main CTA label and behavior
 */
export type PrimaryActionPolicy =
  | 'disabled'                       // Form not ready, CTA disabled
  | 'start-generation'               // Start generation with new briefing
  | 'resume-checkpoint'              // Resume from previous checkpoint
  | 'open-last-artifact'             // Open the most recent artifact (read-only mode)
  | 'regenerate-current-step';       // Regenerate current step with new parameters

/**
 * Secondary action eligibility flags
 * Determines which secondary CTAs are visible/enabled
 */
export type SecondaryActionFlags = {
  canRetry: boolean;                 // Failed step can be retried
  canSkipStep: boolean;              // Current step can be skipped
  canCancelGeneration: boolean;      // Active generation can be cancelled
  canOpenPreviousArtifact: boolean;  // Navigate to previous step's artifact
};

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
  stepStatuses: Record<ToolStep, 'idle' | 'running' | 'completed' | 'error'>;
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
      let status: 'idle' | 'running' | 'completed' | 'error' = 'idle';

      if (input.isGenerationStreamActive && input.currentRunningStep === step) {
        status = 'running';
      } else if (input.completedSteps.has(step)) {
        status = 'completed';
      }
      // Note: 'error' status would be set if we had per-step error tracking

      return [step, status];
    }),
  ) as Record<ToolStep, 'idle' | 'running' | 'completed' | 'error'>;

  return {
    canonicalState,
    primaryActionPolicy,
    secondaryActions,
    statusMessage,
    errorMessage,
    stepStatuses,
  };
};

/**
 * Derive primary action CTA label and enable state based on primary action policy
 * Use this to set button text and disabled state
 * 
 * @example
 * ```ts
 * const policy = output.primaryActionPolicy;
 * const { label, disabled } = derivePrimaryActionLabel(policy);
 * // policy 'start-generation' → label: 'Start Generation', disabled: false
 * ```
 */
export const derivePrimaryActionLabel = (
  policy: PrimaryActionPolicy,
): { label: string; disabled: boolean; tooltip?: string } => {
  switch (policy) {
    case 'disabled':
      return {
        label: 'Completa il form per iniziare',
        disabled: true,
        tooltip: 'Seleziona un progetto e carica un documento di brief',
      };

    case 'start-generation':
      return {
        label: 'Avvia la generazione',
        disabled: false,
      };

    case 'resume-checkpoint':
      return {
        label: 'Riprendi dal checkpoint',
        disabled: false,
        tooltip: 'Continua dal punto in cui la generazione è stata interrotta',
      };

    case 'open-last-artifact':
      return {
        label: 'Visualizza i risultati',
        disabled: false,
        tooltip: "Apri l'artefatto generato",
      };

    case 'regenerate-current-step':
      return {
        label: 'Rigenera',
        disabled: false,
        tooltip: 'Rigenera con i nuovi parametri',
      };
  }
};

/**
 * Build UI state from ToolFormState and runtime generation state
 * Convenience function for ToolPageTemplate
 * 
 * Usage in hook:
 * ```ts
 * export const useToolUiState = (toolKey: SupportedTool, formState: ToolFormState, runtimeState: {...}) => {
 *   return useMemo(() =>
 *     deriveCanonicalToolUiState({
 *       toolKey,
 *       projectId: formState.projectId,
 *       briefingFile: formState.briefingFile,
 *       briefingStatus: formState.briefingStatus,
 *       isGenerationStreamActive: runtimeState.isStreamActive,
 *       completedSteps: runtimeState.completedSteps,
 *       currentRunningStep: runtimeState.currentRunningStep,
 *       hasCompletedPreviousGeneration: runtimeState.hasAnyArtifacts,
 *       lastCheckpointStep: runtimeState.lastCheckpointStep ?? null,
 *       nextAvailableStep: runtimeState.nextAvailableStep ?? null,
 *       generationError: runtimeState.lastError ?? null,
 *     }),
 *     [toolKey, formState, runtimeState],
 *   );
 * };
 * ```
 */
