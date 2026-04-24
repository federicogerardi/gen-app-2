/**
 * Centralized artifact type definitions and enums.
 * Single source of truth for type consistency across streams, guards, and audit.
 */

/** Artifact category—determines output handling, agent selection, and audit classification. */
export const ARTIFACT_TYPES = ['content', 'seo', 'code', 'extraction'] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/** Artifact processing state—lifecycle of a generation. */
export const ARTIFACT_STATUSES = ['generating', 'completed', 'failed'] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

/** Failure reason—audit trail for why an artifact failed or was abandoned. */
export const ARTIFACT_FAILURE_REASONS = [
  'client_disconnect',
  'timeout',
  'error',
  'stale',
] as const;
export type ArtifactFailureReason = (typeof ARTIFACT_FAILURE_REASONS)[number];

/** Tool workflow identifier—maps to routes and determines artifact type. */
export const TOOL_WORKFLOWS = ['meta_ads', 'funnel_pages', 'nextland', 'extraction'] as const;
export type ToolWorkflow = (typeof TOOL_WORKFLOWS)[number];

/** Quota history event status—records the outcome of a generation attempt. */
export const QUOTA_EVENT_STATUSES = ['success', 'error', 'rate_limited'] as const;
export type QuotaEventStatus = (typeof QUOTA_EVENT_STATUSES)[number];

/** Output format for streaming responses. */
export const OUTPUT_FORMATS = ['plain', 'json', 'markdown'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/**
 * Type guards and validators.
 */

export function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && ARTIFACT_TYPES.includes(value as ArtifactType);
}

export function isArtifactStatus(value: unknown): value is ArtifactStatus {
  return typeof value === 'string' && ARTIFACT_STATUSES.includes(value as ArtifactStatus);
}

export function isToolWorkflow(value: unknown): value is ToolWorkflow {
  return typeof value === 'string' && TOOL_WORKFLOWS.includes(value as ToolWorkflow);
}

export function isQuotaEventStatus(value: unknown): value is QuotaEventStatus {
  return typeof value === 'string' && QUOTA_EVENT_STATUSES.includes(value as QuotaEventStatus);
}

export function isOutputFormat(value: unknown): value is OutputFormat {
  return typeof value === 'string' && OUTPUT_FORMATS.includes(value as OutputFormat);
}
