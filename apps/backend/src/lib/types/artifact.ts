/**
 * Centralized artifact type definitions and enums.
 * Single source of truth for type consistency across streams, guards, and audit.
 *
 * ArtifactType, ArtifactStatus, OutputFormat, ArtifactRole, WorkflowRunMode are
 * canonical cross-context Value Objects defined in @gen-app-2/domain (DDD-074).
 * The const arrays are re-exported here for runtime guard usage within this package.
 */

// Cross-context domain primitives — authoritative source: @gen-app-2/domain (DDD-074)
// Import into local scope for use in guards/functions below, then re-export.
import {
  ARTIFACT_TYPES,
  ARTIFACT_STATUSES,
  OUTPUT_FORMATS,
  ARTIFACT_ROLES,
  WORKFLOW_RUN_MODES,
} from '@gen-app-2/domain';
import type { ArtifactType, ArtifactStatus, OutputFormat, ArtifactRole, WorkflowRunMode } from '@gen-app-2/domain';
export {
  ARTIFACT_TYPES,
  ARTIFACT_STATUSES,
  OUTPUT_FORMATS,
  ARTIFACT_ROLES,
  WORKFLOW_RUN_MODES,
};
export type { ArtifactType, ArtifactStatus, OutputFormat, ArtifactRole, WorkflowRunMode };

/** Failure reason—audit trail for why an artifact failed or was abandoned. */
export const ARTIFACT_FAILURE_REASONS = [
  'client_disconnect',
  'timeout',
  'error',
  'stale',
  'llm_timeout',
  'unauthorized',
  'forbidden',
  'not_found',
  'idempotency_conflict',
  'rate_limited',
  'quota_exhausted',
  'extraction_context_insufficient',
  'missing_registry_selector',
  'stream_session_open_failed',
  'ambiguous_routing',
  'extraction_failed',
  'workflow_failed',
  'usage_failed',
  'ownership_failed',
  'stream_failure',
  'persistence_flush_failed',
  'persistence_finalize_failed',
] as const;
export type ArtifactFailureReason = (typeof ARTIFACT_FAILURE_REASONS)[number];

/** Tool workflow identifier—maps to routes and determines artifact type. */
export const TOOL_WORKFLOWS = ['funnel_pages', 'nextland', 'youtube_lf_script', 'extraction'] as const;
export type ToolWorkflow = (typeof TOOL_WORKFLOWS)[number];

/** Quota history event status—records the outcome of a generation attempt. */
export const QUOTA_EVENT_STATUSES = ['success', 'error', 'rate_limited'] as const;
export type QuotaEventStatus = (typeof QUOTA_EVENT_STATUSES)[number];

/** Allowed lifecycle transitions for persisted artifacts. */
export const ARTIFACT_STATUS_TRANSITIONS: Record<ArtifactStatus, readonly ArtifactStatus[]> = {
  generating: ['completed', 'failed'],
  completed: [],
  failed: [],
} as const;

/**
 * Type guards and validators.
 */

export function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && ARTIFACT_TYPES.includes(value as ArtifactType);
}

export function isArtifactStatus(value: unknown): value is ArtifactStatus {
  return typeof value === 'string' && ARTIFACT_STATUSES.includes(value as ArtifactStatus);
}

export function isArtifactFailureReason(value: unknown): value is ArtifactFailureReason {
  return typeof value === 'string' && ARTIFACT_FAILURE_REASONS.includes(value as ArtifactFailureReason);
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

export function canTransitionArtifactStatus(from: ArtifactStatus, to: ArtifactStatus): boolean {
  if (from === to) {
    return true;
  }

  return ARTIFACT_STATUS_TRANSITIONS[from].includes(to);
}

export function normalizeArtifactType(value: unknown, fallback: ArtifactType = 'content'): ArtifactType {
  return isArtifactType(value) ? value : fallback;
}

export function normalizeArtifactStatus(value: unknown, fallback: ArtifactStatus = 'completed'): ArtifactStatus {
  return isArtifactStatus(value) ? value : fallback;
}

export function normalizeArtifactFailureReason(
  value: unknown,
  fallback: ArtifactFailureReason | null = null,
): ArtifactFailureReason | null {
  return isArtifactFailureReason(value) ? value : fallback;
}

export function normalizeToolWorkflow(value: unknown, fallback: ToolWorkflow | null = null): ToolWorkflow | null {
  return isToolWorkflow(value) ? value : fallback;
}
