export const mergeAcquisitionIntoGenerationInput = (
  baseInput: Record<string, unknown>,
  acquisitionOutput: unknown,
): Record<string, unknown> => {
  const normalizedBase = { ...baseInput };

  if (!acquisitionOutput || typeof acquisitionOutput !== 'object' || Array.isArray(acquisitionOutput)) {
    return normalizedBase;
  }

  const acquisitionPayload = acquisitionOutput as Record<string, unknown>;
  return {
    ...normalizedBase,
    acquisition: {
      ...(typeof normalizedBase.acquisition === 'object' && normalizedBase.acquisition !== null
        ? (normalizedBase.acquisition as Record<string, unknown>)
        : {}),
      ...acquisitionPayload,
    },
  };
};
