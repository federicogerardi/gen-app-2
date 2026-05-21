import type {
  ArtifactDetail,
  ArtifactListFilters,
  ArtifactReadProjection,
  SessionListCursor,
  SessionListPage,
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
  LlmStreamAdapter,
  OwnershipDecision,
  UsageDecision,
} from './generation.adapters';

export type ProductionAdapterRuntime = {
  now?: () => Date;
  randomId?: () => string;
};

export interface RedisQuotaRepository {
  claimUsage(input: UsageActorInput): Promise<UsageDecision>;
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
}

export interface PostgresRedisAdapterDependencies {
  ownership: ProjectOwnershipRepository;
  quota: RedisQuotaRepository;
  idempotency: RedisIdempotencyRepository;
  stream: RedisStreamSessionRepository;
  llm: LlmStreamAdapter;
  persistence: PostgresArtifactRepository;
}
