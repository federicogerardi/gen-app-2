/**
 * Shared utility functions consolidating duplicated patterns across frontend.
 * DDD-safe: implementation details only, no domain concepts affected.
 */

/**
 * Generate a unique request identifier.
 * Uses native crypto.randomUUID() if available, falls back to timestamp-based id.
 * Consolidates 3 duplicate implementations from artifact-history.ts, GenerationForm.tsx, ToolPageTemplate.tsx.
 */
export const generateRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}`;
};

/**
 * Generate a deterministic workflow session identifier for one Tool run.
 * Consolidates duplicate implementations from useToolPage and tool-page.machine.
 */
export const generateSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const suffix = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `sess_${Date.now().toString(36)}_${suffix}`;
  }

  return `sess_${Date.now().toString(36)}`;
};

/**
 * Normalize a string identifier to kebab-case.
 * Trims, lowercases, converts underscores to hyphens.
 * Consolidates normalize() and normalizeToolKey() patterns from step-hydration.ts and artifact-history.ts.
 */
export const normalizeIdentifier = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return normalized.length > 0 ? normalized : null;
};

/**
 * Extract a string field from a source (request input, artifact input, or direct record).
 * Consolidates readInputString() patterns from artifact-history.ts and ToolPageTemplate.tsx.
 * Handles GenerationRequest input, GenerationArtifact sourceRequest.input, or direct record.
 */
export const readInputField = (
  source: Record<string, unknown> | { input?: Record<string, unknown> } | undefined | null,
  fieldName: string,
): string | null => {
  let input: Record<string, unknown> | undefined;

  if (source && typeof source === 'object' && 'input' in source) {
    // GenerationRequest or similar with .input property
    input = (source as { input?: Record<string, unknown> }).input;
  } else if (source && typeof source === 'object') {
    // Direct record
    input = source as Record<string, unknown>;
  }

  const value = input?.[fieldName];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Check if a filename has an allowed briefing document extension.
 * Consolidates pattern from GenerationForm.tsx for reuse.
 */
export const isAllowedBriefingExtension = (fileName: string): boolean => {
  const normalized = fileName.toLowerCase();
  return normalized.endsWith('.docx') || normalized.endsWith('.txt') || normalized.endsWith('.md');
};
