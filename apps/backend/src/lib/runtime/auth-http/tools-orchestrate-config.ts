export const DEFAULT_TOOLS_ORCHESTRATE_TIMEOUT_MS = 5_000;
export const DEFAULT_TOOLS_ORCHESTRATE_ARTIFACT_SCAN_LIMIT = 1_000;
export const DEFAULT_TOOLS_HYDRATE_ARTIFACT_SCAN_LIMIT = 1_000;

const parsePositiveInteger = (raw: string | undefined, fallback: number): number => {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const resolveToolsOrchestrateTimeoutMs = (input?: number): number => {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return Math.trunc(input);
  }

  return parsePositiveInteger(
    process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS,
    DEFAULT_TOOLS_ORCHESTRATE_TIMEOUT_MS,
  );
};

export const resolveToolsOrchestrateArtifactScanLimit = (input?: number): number => {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return Math.trunc(input);
  }

  return parsePositiveInteger(
    process.env.TOOLS_ORCHESTRATE_ARTIFACT_SCAN_LIMIT,
    DEFAULT_TOOLS_ORCHESTRATE_ARTIFACT_SCAN_LIMIT,
  );
};

export const resolveToolsHydrateArtifactScanLimit = (input?: number): number => {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return Math.trunc(input);
  }

  return parsePositiveInteger(
    process.env.TOOLS_HYDRATE_ARTIFACT_SCAN_LIMIT,
    DEFAULT_TOOLS_HYDRATE_ARTIFACT_SCAN_LIMIT,
  );
};