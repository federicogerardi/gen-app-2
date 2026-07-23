export { isExtractionContextValidForTool, hasRequiredExtractionFields, hasActionableExtractionPayload } from '../../machines/extraction-context-validity';
export { ReadinessRequiredExtractionFieldKeysByTool, normalizeExtractionFieldKeysForTool } from '../extraction-field-matrix';

/**
 * Business Rule: Extraction Readiness
 *
 * Consolida la validazione dei campi estrazione in un punto di accesso.
 * Determina se l'ExtractionContext per un dato tool è completo e valido.
 *
 * Delegato a extraction-context-validity.ts e extraction-field-matrix.ts.
 *
 * @ddd BusinessRule ExtractionReadiness
 * @ddd Related DDD-007 DDD-021 DDD-038
 */
