import type {
  ArtifactDetail,
  ArtifactListFilters,
  ArtifactReadProjection,
  SessionListCursor,
  SessionListPage,
  AdminSessionListPage,
  ArtifactSummary,
} from '../types/artifacts';
import type {
  IdempotencyCoordinatorInput,
  PersistenceBatchInput,
  StreamTransportInput,
  UsageActorInput,
} from '../types/xstate';
import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
} from '../types/projects';

import type {
  IdempotencyDecision,
  LlmGenerateAdapter,
  LlmStreamAdapter,
  OwnershipDecision,
  UsageDecision,
} from './generation.adapters';

import type { Pool } from 'pg';

export type ProductionAdapterRuntime = {
  now?: () => Date;
  randomId?: () => string;
};

export interface RedisQuotaRepository {
  claimUsage(input: UsageActorInput): Promise<UsageDecision>;
  consumeCredits(input: import('./generation.adapters').ConsumeCreditsInput): Promise<void>;
  recordArtifactSuccess(input: import('./generation.adapters').RecordArtifactSuccessInput): Promise<void>;
}

export interface ProjectOwnershipRepository {
  checkProjectOwnership(input: { userId: string; projectId: string }): Promise<OwnershipDecision>;
}

export interface RedisIdempotencyRepository {
  checkAndClaim(input: IdempotencyCoordinatorInput): Promise<IdempotencyDecision>;
  markCompleted(
    input: IdempotencyCoordinatorInput,
    artifactId: string,
    content: string,
  ): Promise<void>;
  markFailed(input: IdempotencyCoordinatorInput): Promise<void>;
}

export interface RedisStreamSessionRepository {
  openSession(input: StreamTransportInput): Promise<{ sessionId: string }>;
}

export interface PostgresArtifactRepository {
  flushProgress(input: PersistenceBatchInput, sequence: number): Promise<void>;
  finalizeSuccess(input: PersistenceBatchInput): Promise<void>;
  finalizeFailure(input: PersistenceBatchInput, reason: string): Promise<void>;
}

export interface ProjectQueryRepository {
  listProjectsByUser(userId: string): Promise<ProjectSummary[]>;
  getProjectByIdForUser(userId: string, projectId: string): Promise<ProjectDetail | null>;
  createProjectForUser(userId: string, input: CreateProjectInput): Promise<ProjectDetail>;
  updateProjectForUser(
    userId: string,
    projectId: string,
    input: { name?: string; status?: 'active' | 'archived' }
  ): Promise<ProjectDetail | null>;
}

export interface ArtifactQueryRepository {
  listArtifacts(filters: ArtifactListFilters): Promise<ArtifactSummary[]>;
  countArtifacts(filters: ArtifactListFilters): Promise<number>;
  listArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<ArtifactSummary[]>;
  listRecentCompletedArtifactsForToolByUser(
    userId: string,
    input: { projectId: string; workflowType: string; limit: number },
  ): Promise<ArtifactSummary[]>;
  countArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<number>;
  getArtifactById(artifactId: string, projection?: ArtifactReadProjection): Promise<ArtifactDetail | null>;
  getArtifactByIdForUser(
    userId: string,
    artifactId: string,
    projection?: ArtifactReadProjection,
  ): Promise<ArtifactDetail | null>;
  getArtifactsByIdsForUser(
    userId: string,
    artifactIds: string[],
    projection?: ArtifactReadProjection,
  ): Promise<ArtifactDetail[]>;
  listArtifactDetailsBySession(
    userId: string,
    sessionId: string,
    projection?: ArtifactReadProjection,
  ): Promise<ArtifactDetail[]>;
  getArtifactDetailBySessionStep(
    userId: string,
    sessionId: string,
    stepKey: string,
    projection?: ArtifactReadProjection,
  ): Promise<ArtifactDetail | null>;
  listSessionSummaries(
    userId: string,
    projectId: string | null,
    options?: { limit?: number; cursor?: SessionListCursor | null },
  ): Promise<SessionListPage>;
  listSessionSummariesAll(
    projectId: string | null,
    options?: { limit?: number; cursor?: SessionListCursor | null },
  ): Promise<AdminSessionListPage>;
  listArtifactDetailsBySessionAny(
    sessionId: string,
    projection?: ArtifactReadProjection,
  ): Promise<ArtifactDetail[]>;
}

export interface OrchestrateArtifactCache {
  setStepArtifact(
    userId: string,
    projectId: string,
    workflowType: string,
    stepKey: string,
    artifactId: string,
  ): Promise<void>;

  getCompletedArtifactsByStep(
    userId: string,
    projectId: string,
    workflowType: string,
  ): Promise<Record<string, string>>;
}

export type ToolWorkflowJobCreateInput = {
  jobId: string;
  userId: string;
  projectId: string;
  toolKey: string;
  workflowType: string;
  totalSteps: number;
  model?: string;
};

export type ToolWorkflowJobProgressInput = {
  completedSteps: number;
  progress: Record<string, unknown>;
};

export type ToolWorkflowJobCompleteInput = {
  sessionId: string;
  artifactIds: string[];
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
};

export type ToolWorkflowJobFailedInput = {
  errorMessage: string;
};

export type ToolWorkflowJobDetail = {
  jobId: string;
  userId: string;
  projectId: string;
  toolKey: string;
  workflowType: string;
  sessionId: string | null;
  status: string;
  totalSteps: number;
  completedSteps: number;
  progress: Record<string, unknown>;
  result: Record<string, unknown> | null;
  model: string | null;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type ToolWorkflowJobListFilters = {
  userId?: string;
  projectId?: string;
  toolKey?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

export type ToolWorkflowJobSummary = {
  jobId: string;
  userId: string;
  projectId: string;
  toolKey: string;
  workflowType: string;
  sessionId: string | null;
  status: string;
  totalSteps: number;
  completedSteps: number;
  model: string | null;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type ToolWorkflowJobListResult = {
  jobs: ToolWorkflowJobSummary[];
  total: number;
};

export type SessionCostAndTokens = {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
};

export interface ToolWorkflowJobRepository {
  create(input: ToolWorkflowJobCreateInput): Promise<void>;
  updateStatus(jobId: string, status: string): Promise<void>;
  updateProgress(jobId: string, input: ToolWorkflowJobProgressInput): Promise<void>;
  markCompleted(jobId: string, input: ToolWorkflowJobCompleteInput): Promise<void>;
  markFailed(jobId: string, input: ToolWorkflowJobFailedInput): Promise<void>;
  markCancelled(jobId: string): Promise<void>;
  findById(jobId: string): Promise<ToolWorkflowJobDetail | null>;
  listByFilter(filters: ToolWorkflowJobListFilters): Promise<ToolWorkflowJobListResult>;
  aggregateSessionCostAndTokens(sessionId: string): Promise<SessionCostAndTokens>;
}

export interface PostgresRedisAdapterDependencies {
  pg?: Pool;
  ownership: ProjectOwnershipRepository;
  quota: RedisQuotaRepository;
  idempotency: RedisIdempotencyRepository;
  stream: RedisStreamSessionRepository;
  llm: LlmStreamAdapter;
  generate: LlmGenerateAdapter;
  persistence: PostgresArtifactRepository;
  orchestrateCache: OrchestrateArtifactCache | null;
  toolWorkflowJob: ToolWorkflowJobRepository | null;
}
