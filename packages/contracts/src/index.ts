/**
 * Shared FE↔BE Contract Types
 *
 * This is the single authoritative source for cross-context generation contracts:
 * - GenerationRequest: command to initiate a generation
 * - BackendStreamEvent: SSE events during generation
 * - Value Objects: ArtifactType, OutputFormat
 *
 * Both frontend and backend import exclusively from this package.
 * Structural parity is enforced via compile-time guards.
 *
 * DDD canonical terms:
 *   - GenerationRequest (DDD-002)
 *   - BackendStreamEvent (DDD-009)
 *   - ArtifactType (DDD-001 scope)
 *   - OutputFormat (DDD-022 scope)
 *
 * References:
 *   - DDD-023: @gen-app-2/contracts is the single authoritative FE source
 *   - Frontend consumer: frontend/src/features/generation/contracts/backend-stream.ts
 *   - Backend authority: src/lib/runtime/request-contract.ts, stream-contract.ts
 */

export {
  GENERATION_ROUTE_TOOL_KEY,
  isGenerationRequestToolKey,
  isGenerationRouteToolKey,
  isToolKey,
  isToolWorkflowType,
  normalizeToolKeyCandidate,
  resolveGenerationWorkflowTypeCandidate,
  resolveToolKeyFromWorkflowType,
  resolveToolWorkflowType,
  TOOL_KEYS,
  TOOL_KEY_BY_WORKFLOW_TYPE,
  TOOL_STEP_DEPENDENCIES,
  TOOL_STEP_ORDER,
  TOOL_WORKFLOW_BY_TOOL_KEY,
  TOOL_WORKFLOW_DEFINITIONS,
} from './tool-workflows';
export type {
  GenerationRequestToolKey,
  GenerationRouteToolKey,
  GenerationWorkflowType,
  ToolKey,
  ToolStep,
  ToolWorkflowDefinition,
  ToolWorkflowStepDefinition,
  ToolWorkflowStepDependencyMap,
  ToolWorkflowStepOrder,
  ToolWorkflowType,
} from './tool-workflows';

import type {
  GenerationRequestToolKey,
  GenerationRouteToolKey,
  GenerationWorkflowType,
  ToolKey,
  ToolStep,
  ToolWorkflowType,
} from './tool-workflows';

// =====================================================================
// Value Objects — re-exported from @gen-app-2/domain (DDD-074)
// =====================================================================

// Import for local use in GenerationRequest type definitions
import type { ArtifactType, OutputFormat, WorkflowRunMode } from '@gen-app-2/domain';
export type { ArtifactType, OutputFormat, WorkflowRunMode } from '@gen-app-2/domain';

// =====================================================================
// Domain Commands
// =====================================================================

/**
 * Canonical generation request command.
 *
 * Initiates a generation workflow. Carries request identity, user context, artifact metadata,
 * and tool-specific routing information.
 *
 * DDD-002: GenerationRequest is the canonical term for the command that initiates generation.
 * DDD-021: ExtractionContext (input.extractionPayload + briefingText) is mandatory at dispatch time.
 *
 * Fields:
 *   - requestId: Unique identifier for deduplication and stream correlation
 *   - userId: Authenticated user (from AuthSessionPrincipal)
 *   - projectId: Scoping boundary for quota and artifact history
 *   - artifactType: Determines output handling and agent selection (DDD-001)
 *   - model: LlmModelId — must match the key of an enabled LlmModel in the LlmModelCatalog. Default: 'openrouter/auto'. See DDD-056.
 *   - input: Extraction context, tone, prompt, and tool-specific payloads
 *   - toolKey: Tool orchestration identifier (DDD-025); kebab-case (e.g., "funnel-pages")
 *   - workflowType: Artifact routing determinant (snake_case for DB compat; e.g., "funnel_pages")
 *   - idempotencyKey: Optional deduplication token (DDD-019)
 *   - outputFormat: Formatting contract for SSE stream (default: 'plain')
 *   - registryVersion, registrySnapshotRef: Registry snapshot binding
 *   - briefingId: Optional prior extraction artifact ID for multi-step context
 *   - extractionArtifactId: Optional prior extraction artifact ID for context recovery
 *   - stepDependencyArtifactIds: Prior step artifact IDs for multi-step workflow
 */
export type GenerationRequestInput = {
  // Canonical generation dispatch fields
  prompt?: string;
  step?: ToolStep | string;
  intent?: WorkflowRunMode;
  tone?: string;
  notes?: string;
  toolKey?: ToolKey;
  briefingId?: string | null;
  briefingText?: string;
  briefingFileName?: string | null;
  extractionArtifactId?: string | null;
  extractionPayload?: Record<string, unknown>;
  stepDependencyArtifactIds?: string[] | null;
  stepDependencyArtifactIdsByStep?: Partial<Record<ToolStep, string>>;
  stepDependencyArtifactContentsByStep?: Partial<Record<ToolStep, string>>;
  sourceArtifactId?: string | null;
  checkpointArtifactId?: string | null;
  relaunchFromArtifactId?: string | null;
  normalizedText?: string;
  parsedFormat?: 'txt' | 'md' | 'docx';

  // Canonical extraction envelope persisted by backend adapters.
  extraction?: {
    payload?: Record<string, unknown>;
    normalizedText?: string;
    parsedFormat?: 'txt' | 'md' | 'docx';
  };

  // Persisted orchestration metadata envelope used by artifact/session projections.
  toolWorkflow?: {
    toolKey?: ToolKey;
    workflowType?: ToolWorkflowType | 'extraction';
    stepKey?: ToolStep | string;
    artifactRole?: 'step' | 'final';
    runMode?: WorkflowRunMode;
    sessionId?: string;
    dependsOnSteps?: string[];
    dependencyArtifactIds?: string[];
    dependencyArtifactIdsByStep?: Partial<Record<ToolStep, string>>;
  };

  // Backend enrichment fields attached in request normalization.
  resolvedPromptTemplate?: string;
  resolvedPromptSource?: string;

  /** @deprecated Legacy relaunch alias retained for backward-compat reads. */
  relaunchMode?: WorkflowRunMode;
};

type GenerationRequestBase = {
  requestId: string;
  userId: string;
  projectId: string;
  // Unique session identifier for multi-step tool workflows; generated by Frontend
  // at tool-page load; identifies all requests for one session.
  sessionId?: string;
  artifactType: ArtifactType;
  // LlmModelId — see DDD-056
  model: string;
  idempotencyKey?: string;
  outputFormat?: OutputFormat;
  registryVersion?: string;
  registrySnapshotRef?: string;
  briefingId?: string | null;
  extractionArtifactId?: string | null;
  stepDependencyArtifactIds?: string[] | null;
};

export type ToolGenerationRequest = GenerationRequestBase & {
  input: GenerationRequestInput;
  toolKey: ToolKey;
  workflowType: ToolWorkflowType;
};

export type ExtractionGenerationRequest = GenerationRequestBase & {
  input: GenerationRequestInput & {
    toolKey?: ToolKey;
  };
  toolKey: GenerationRouteToolKey;
  workflowType: 'extraction';
};

export type GenericGenerationRequest = GenerationRequestBase & {
  input: GenerationRequestInput;
  toolKey?: null;
  workflowType?: null;
};

export type GenerationRequest =
  | ToolGenerationRequest
  | ExtractionGenerationRequest
  | GenericGenerationRequest
  | (GenerationRequestBase & {
      input: GenerationRequestInput;
      toolKey?: GenerationRequestToolKey | null;
      workflowType?: GenerationWorkflowType | null;
    });

// =====================================================================
// Domain Events
// =====================================================================

/**
 * Server-Sent Event emitted during generation.
 *
 * Types:
 *   - start: Generation initiated, artifact created
 *   - chunk: Incremental content token streamed
 *   - terminal: Generation completed or failed
 *
 * DDD-009: BackendStreamEvent is the canonical term for SSE events.
 * DDD-035, DDD-036: See domain events for step-level progression events (internal).
 */
export type BackendStreamEvent =
  | {
      event: 'start';
      data: { requestId: string; artifactId: string };
    }
  | {
      event: 'chunk';
      data: { artifactId: string; chunk: string; sequence: number };
    }
  | {
      event: 'terminal';
      data: {
        artifactId: string | null;
        status: 'completed' | 'failed';
        reason: string | null;
        completedStep?: string | null;
        failedStep?: string | null;
      };
    };

/**
 * Serialize a BackendStreamEvent for SSE wire transport.
 */
export const serializeSseEvent = (event: BackendStreamEvent): string => {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
};

// =====================================================================
// Feedback Center Contracts (DDD-065 / DDD-066)
// =====================================================================

export type ProductChangelogStatus = 'draft' | 'published';

export type UserReportCategory = 'issue' | 'feature-request' | 'other';

export type UserReportStatus = 'submitted' | 'triaged' | 'github-published' | 'closed';

export type ProductChangelogDto = {
  id: string;
  title: string;
  body: string;
  status: ProductChangelogStatus;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserReportDto = {
  id: string;
  category: UserReportCategory;
  status: UserReportStatus;
  title: string;
  description: string;
  createdBy: string;
  triagedBy: string | null;
  triagedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  githubIssueUrl: string | null;
};

export type GitHubIssueLinkDto = {
  userReportId: string;
  repository: string;
  issueNumber: number;
  issueUrl: string;
  publishedBy: string;
  publishedAt: string;
};

export type CreateProductChangelogCommand = {
  title: string;
  body: string;
};

export type ArchiveProductChangelogCommand = Record<string, never>;

export type CreateUserReportCommand = {
  category: UserReportCategory;
  title: string;
  description: string;
};

export type UpdateUserReportStatusCommand = {
  status: Extract<UserReportStatus, 'triaged' | 'closed'>;
};

export type PublishUserReportIssueCommand = {
  owner: string;
  repo: string;
  title?: string;
  body?: string;
};
