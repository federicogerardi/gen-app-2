export type { ToolInputRequirementMatrix, ToolInputRequirementMatrixEntry } from '../tool-page-selectors';
export { deriveToolInputRequirementMatrix } from '../tool-page-selectors';

/**
 * Business Rule: Input Requirement Matrix
 *
 * Per un dato tool e form state, restituisce la matrice completa dei campi di input
 * con il loro stato di soddisfacimento. Usata dal FE per determinare se mostrare
 * warning di campi mancanti e per il readiness check.
 *
 * Delegato a tool-page-selectors.ts (funzione pura esistente).
 *
 * @ddd BusinessRule InputRequirementMatrix
 * @ddd Related DDD-026
 */
