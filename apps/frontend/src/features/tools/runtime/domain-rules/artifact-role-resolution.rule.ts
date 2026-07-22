export type ArtifactRole = 'step' | 'final';

/**
 * Business Rule: Artifact Role Classification
 *
 * Determina se un artifact è uno step intermedio (non addebita crediti,
 * incrementa solo artifact gate) o l'output finale (addebita crediti).
 *
 * @ddd BusinessRule ArtifactRoleClassification
 * @ddd Related DDD-033 DDD-138 DDD-139 DDD-140
 */
export const resolveArtifactRole = (
  planSteps: ReadonlyArray<{ key: string }>,
  stepKey: string,
): ArtifactRole => {
  if (planSteps.length === 0) {
    return 'step';
  }
  const isLastStep = planSteps[planSteps.length - 1]?.key === stepKey;
  return isLastStep ? 'final' : 'step';
};
