/**
 * @gen-app-2/domain — Cross-context canonical domain primitives.
 *
 * Hosts only true cross-context domain assets:
 * - stable Value Objects shared by multiple bounded contexts
 * - invariant-preserving const arrays for runtime guards
 * - domain primitives that must remain framework-agnostic
 *
 * DDD governance: DDD-074
 * DDD references:
 *   - docs/01-requirements/domain-ubiquitous-language-glossary.md
 *   - docs/02-design/domain-bounded-context-map.md
 *   - docs/07-governance/domain-naming-decision-log.md
 *
 * Consumers: @gen-app-2/contracts (re-exports ArtifactType, OutputFormat,
 * WorkflowRunMode), @gen-app-2/backend (imports ArtifactType, ArtifactStatus,
 * OutputFormat, ArtifactRole from this package via artifact.ts).
 */

// =====================================================================
// ArtifactType — DDD-001
// =====================================================================

/** Artifact category — determines output handling, agent selection, and audit classification. */
export const ARTIFACT_TYPES = ['content', 'seo', 'code', 'extraction', 'crawl', 'analysis'] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

// =====================================================================
// ArtifactStatus — DDD-017
// =====================================================================

/** Artifact processing state — lifecycle of a generation attempt. */
export const ARTIFACT_STATUSES = ['generating', 'completed', 'failed'] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

// =====================================================================
// OutputFormat — DDD-022 scope
// =====================================================================

/** Output formatting contract for streamed response. */
export const OUTPUT_FORMATS = ['plain', 'json', 'markdown'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

// =====================================================================
// WorkflowRunMode — DDD-037
// =====================================================================

/** Intent of a generation invocation relative to prior runs. */
export const WORKFLOW_RUN_MODES = ['new', 'resume', 'regenerate'] as const;
export type WorkflowRunMode = (typeof WORKFLOW_RUN_MODES)[number];

// =====================================================================
// ArtifactRole — DDD-033
// =====================================================================

/**
 * Lifecycle role of an Artifact within a multi-step Tool execution chain.
 * - 'step': intermediate artifact produced by a non-final WorkflowStep.
 * - 'final': artifact produced by the last WorkflowStep in the chain.
 */
export const ARTIFACT_ROLES = ['step', 'final'] as const;
export type ArtifactRole = (typeof ARTIFACT_ROLES)[number];
