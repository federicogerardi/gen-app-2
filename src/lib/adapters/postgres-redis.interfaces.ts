import type {
  ArtifactDetail,
  ArtifactListFilters,
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
  UsageDecision,
} from './generation.adapters';

export type ProductionAdapterRuntime = {
  now?: () => Date;
  randomId?: () => string;
};

export interface RedisQuotaRepository {
  claimUsage(input: UsageActorInput): Promise<UsageDecision>;
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
  listArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<ArtifactSummary[]>;
  getArtifactByIdForUser(userId: string, artifactId: string): Promise<ArtifactDetail | null>;
}

export interface PostgresRedisAdapterDependencies {
  quota: RedisQuotaRepository;
  idempotency: RedisIdempotencyRepository;
  stream: RedisStreamSessionRepository;
  llm: LlmStreamAdapter;
  persistence: PostgresArtifactRepository;
}
