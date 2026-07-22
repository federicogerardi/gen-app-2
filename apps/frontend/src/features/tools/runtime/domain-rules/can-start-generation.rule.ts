import type { ReadinessSnapshot } from '../../machines/tool-page-readiness';
import type { PrimaryActionPolicy } from '../../../generation/ui/tool-ux-state';

export type CanStartGenerationInput = {
  readiness: ReadinessSnapshot;
  primaryActionPolicy: PrimaryActionPolicy;
};

/**
 * Business Rule: Generation Start Gate
 *
 * Restituisce true se l'utente può avviare la generazione.
 * Due path:
 * 1. Readiness standard: canStartFlow === true E policy startable
 * 2. Asset-based override: l'unico blocker è missing_extraction_context
 *    (il React layer ha verificato che workspace Assets coprono il fabbisogno)
 *
 * @ddd BusinessRule GenerationStartGate
 * @ddd Related DDD-020 DDD-006
 */
export const canStartGeneration = (input: CanStartGenerationInput): boolean => {
  const extractionOnlyMissing =
    !input.readiness.canStartFlow
    && input.readiness.reasonCodes.length === 1
    && input.readiness.reasonCodes[0] === 'missing_extraction_context';

  if (extractionOnlyMissing) {
    return true;
  }

  return input.readiness.canStartFlow && isPolicyStartable(input.primaryActionPolicy);
};

const isPolicyStartable = (policy: PrimaryActionPolicy): boolean =>
  policy === 'start-generation' || policy === 'resume-checkpoint' || policy === 'regenerate-current-step';
