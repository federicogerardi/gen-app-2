import type {
  IdempotencyCoordinatorInput,
  PersistenceBatchInput,
  StreamTransportInput,
  UsageActorInput,
} from '../types/xstate';

import type {
  IdempotencyDecision,
  LlmGenerateAdapter,
  LlmStreamAdapter,
  UsageDecision,
} from './generation.adapters';
import { createSyntheticLlmStreamAdapter, createSyntheticLlmGenerateAdapter } from './generation.adapters';
import type { ArtifactStatus } from '../types/artifact';
import { createPostgresRedisGenerationAdapters } from './postgres-redis.adapters';
import type {
  ArtifactDetail,
  ArtifactListFilters,
  ArtifactReadProjection,
  SessionListCursor,
  SessionListPage,
  ArtifactSummary,
} from '../types/artifacts';
import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
} from '../types/projects';

import type {
  ArtifactQueryRepository,
  PostgresArtifactRepository,
  PostgresRedisAdapterDependencies,
  ProjectOwnershipRepository,
  ProjectQueryRepository,
  ProductionAdapterRuntime,
  RedisIdempotencyRepository,
  RedisQuotaRepository,
  RedisStreamSessionRepository,
} from './postgres-redis.interfaces';
import { normalizeToolWorkflowKey } from '../runtime/workflow-normalizers';
import { resolveClaimUsageDecision } from './postgres-redis.shared';

type StubQuotaBucket = {
  limit: number;
  used: number;
  artifactLimit: number;
  artifactUsed: number;
};

type StubIdempotencyRecord = {
  status: 'in_progress' | 'completed' | 'failed';
  artifactId: string | null;
  content: string;
};

type StubArtifactRecord = {
  status: ArtifactStatus;
  content: string;
  updatedAt: string;
};

const toIsoNow = (runtime?: ProductionAdapterRuntime): string =>
  (runtime?.now ?? (() => new Date()))().toISOString();

const createRandomId = (runtime?: ProductionAdapterRuntime): string => {
  return runtime?.randomId?.() ?? Math.random().toString(36).slice(2, 12);
};

type StubProjectRecord = {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export type StubArtifactQueryRecord = {
  artifactId: string;
  requestId: string;
  userId: string;
  projectId: string;
  artifactType: ArtifactSummary['artifactType'];
  status: ArtifactSummary['status'];
  model: string;
  workflowType: ArtifactSummary['workflowType'];
  sessionId?: string | null;
  stepKey?: string | null;
  artifactRole?: 'step' | 'final' | null;
  runMode?: 'new' | 'resume' | 'regenerate' | null;
  input: Record<string, unknown>;
  content: string;
  failureReason: ArtifactDetail['failureReason'];
  createdAt: string;
  updatedAt: string;
};

export class RedisQuotaRepositoryStub implements RedisQuotaRepository {
  private readonly buckets = new Map<string, StubQuotaBucket>();

  constructor(private readonly defaultQuotaLimit = 100) {}

  private getBucket(userId: string): StubQuotaBucket {
    const existing = this.buckets.get(userId);
    if (existing) return existing;
    const fresh: StubQuotaBucket = {
      limit: this.defaultQuotaLimit,
      used: 0,
      artifactLimit: 1000,
      artifactUsed: 0,
    };
    this.buckets.set(userId, fresh);
    return fresh;
  }

  async claimUsage(input: UsageActorInput): Promise<UsageDecision> {
    const bucket = this.getBucket(input.userId);

    // Check artifact gate (DDD-140)
    if (bucket.artifactUsed >= bucket.artifactLimit) {
      return resolveClaimUsageDecision({
        rateLimitExceeded: false,
        quotaAvailable: false,
        hasConflict: false,
        ...(input.creditCost !== undefined ? { creditCost: input.creditCost } : {}),
      });
    }

    // Check credit availability (DDD-137, DDD-143)
    if (bucket.used >= bucket.limit) {
      return resolveClaimUsageDecision({
        rateLimitExceeded: false,
        quotaAvailable: false,
        hasConflict: false,
        ...(input.creditCost !== undefined ? { creditCost: input.creditCost } : {}),
      });
    }

    return resolveClaimUsageDecision({
      rateLimitExceeded: false,
      quotaAvailable: true,
      hasConflict: false,
      ...(input.creditCost !== undefined ? { creditCost: input.creditCost } : {}),
    });
  }

  async consumeCredits(input: import('./generation.adapters').ConsumeCreditsInput): Promise<void> {
    const bucket = this.getBucket(input.userId);
    bucket.used += input.creditCost;
    this.buckets.set(input.userId, bucket);
  }

  async recordArtifactSuccess(input: import('./generation.adapters').RecordArtifactSuccessInput): Promise<void> {
    const bucket = this.getBucket(input.userId);
    bucket.artifactUsed += 1;
    this.buckets.set(input.userId, bucket);
  }
}

export class ProjectOwnershipRepositoryStub implements ProjectOwnershipRepository {
  async checkProjectOwnership(_input: { userId: string; projectId: string }) {
    return { owned: true };
  }
}

export class RedisIdempotencyRepositoryStub implements RedisIdempotencyRepository {
  private readonly records = new Map<string, StubIdempotencyRecord>();

  async checkAndClaim(input: IdempotencyCoordinatorInput): Promise<IdempotencyDecision> {
    const existing = this.records.get(input.idempotencyKey);
    if (!existing) {
      this.records.set(input.idempotencyKey, {
        status: 'in_progress',
        artifactId: null,
        content: '',
      });
      return { status: 'claimed' };
    }

    if (existing.status === 'completed' && existing.artifactId) {
      return {
        status: 'replay',
        artifactId: existing.artifactId,
        content: existing.content,
      };
    }

    return {
      status: 'conflict',
      reason: 'idempotency_conflict',
    };
  }

  async markCompleted(
    input: IdempotencyCoordinatorInput,
    artifactId: string,
    content: string,
  ): Promise<void> {
    this.records.set(input.idempotencyKey, {
      status: 'completed',
      artifactId,
      content,
    });
  }

  async markFailed(input: IdempotencyCoordinatorInput): Promise<void> {
    const existing = this.records.get(input.idempotencyKey);
    if (!existing) {
      return;
    }

    this.records.set(input.idempotencyKey, {
      ...existing,
      status: 'failed',
    });
  }
}

export class RedisStreamSessionRepositoryStub implements RedisStreamSessionRepository {
  constructor(private readonly runtime?: ProductionAdapterRuntime) {}

  async openSession(input: StreamTransportInput): Promise<{ sessionId: string }> {
    return {
      sessionId: `${input.requestId}:${input.artifactId}:${createRandomId(this.runtime)}`,
    };
  }
}

export class PostgresArtifactRepositoryStub implements PostgresArtifactRepository {
  private readonly records = new Map<string, StubArtifactRecord>();

  constructor(private readonly runtime?: ProductionAdapterRuntime) {}

  async flushProgress(input: PersistenceBatchInput, _sequence: number): Promise<void> {
    const current = this.records.get(input.artifactId);
    this.records.set(input.artifactId, {
      status: 'generating',
      content: input.contentBuffer,
      updatedAt: toIsoNow(this.runtime),
      ...current,
    });
  }

  async finalizeSuccess(input: PersistenceBatchInput): Promise<void> {
    this.records.set(input.artifactId, {
      status: 'completed',
      content: input.contentBuffer,
      updatedAt: toIsoNow(this.runtime),
    });
  }

  async finalizeFailure(input: PersistenceBatchInput, reason: string): Promise<void> {
    const current = this.records.get(input.artifactId);
    this.records.set(input.artifactId, {
      status: 'failed',
      content: current?.content ?? input.contentBuffer,
      updatedAt: `${toIsoNow(this.runtime)}#${reason}`,
    });
  }
}

export class ProjectQueryRepositoryStub implements ProjectQueryRepository {
  private readonly projects = new Map<string, StubProjectRecord>();

  constructor(private readonly runtime?: ProductionAdapterRuntime) {}

  async listProjectsByUser(userId: string): Promise<ProjectSummary[]> {
    return [...this.projects.values()]
      .filter((project) => project.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        updatedAt: project.updatedAt,
      }));
  }

  async getProjectByIdForUser(userId: string, projectId: string): Promise<ProjectDetail | null> {
    const project = this.projects.get(projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    return {
      id: project.id,
      userId: project.userId,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async createProjectForUser(userId: string, input: CreateProjectInput): Promise<ProjectDetail> {
    const timestamp = toIsoNow(this.runtime);
    const id = `proj_${createRandomId(this.runtime)}`;
    const record: StubProjectRecord = {
      id,
      userId,
      name: input.name,
      description: input.description ?? '',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.projects.set(id, record);

    return {
      id,
      userId,
      name: record.name,
      description: record.description,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async updateProjectForUser(
    userId: string,
    projectId: string,
    input: { name?: string; status?: 'active' | 'archived' }
  ): Promise<ProjectDetail | null> {
    const project = this.projects.get(projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    const timestamp = toIsoNow(this.runtime);
    if (input.name !== undefined) project.name = input.name;
    if (input.status !== undefined) project.status = input.status;
    project.updatedAt = timestamp;

    return {
      id: project.id,
      userId: project.userId,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}

export class ArtifactQueryRepositoryStub implements ArtifactQueryRepository {
  private readonly artifacts = new Map<string, StubArtifactQueryRecord>();

  private mapToDetail(
    artifact: StubArtifactQueryRecord,
    projection: ArtifactReadProjection = {},
  ): ArtifactDetail {
    return {
      artifactId: artifact.artifactId,
      requestId: artifact.requestId,
      userId: artifact.userId,
      projectId: artifact.projectId,
      artifactType: artifact.artifactType,
      status: artifact.status,
      model: artifact.model,
      workflowType: artifact.workflowType,
      sessionId: artifact.sessionId ?? null,
      stepKey: artifact.stepKey ?? null,
      artifactRole: artifact.artifactRole ?? null,
      runMode: artifact.runMode ?? null,
      input: projection.includeInput === true ? artifact.input : {},
      content: projection.includeContent === true ? artifact.content : '',
      failureReason: artifact.failureReason,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
    };
  }

  async countArtifacts(filters: ArtifactListFilters): Promise<number> {
    return [...this.artifacts.values()].filter((artifact) => {
      if (filters.type && artifact.artifactType !== filters.type) {
        return false;
      }

      if (filters.status && artifact.status !== filters.status) {
        return false;
      }

      if (filters.projectId && artifact.projectId !== filters.projectId) {
        return false;
      }

      if (filters.from && Date.parse(artifact.updatedAt) < Date.parse(filters.from)) {
        return false;
      }

      if (filters.to && Date.parse(artifact.updatedAt) > Date.parse(filters.to)) {
        return false;
      }

      return true;
    }).length;
  }

  async listArtifacts(filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    const filtered = [...this.artifacts.values()]
      .filter((artifact) => {
        if (filters.type && artifact.artifactType !== filters.type) {
          return false;
        }

        if (filters.status && artifact.status !== filters.status) {
          return false;
        }

        if (filters.projectId && artifact.projectId !== filters.projectId) {
          return false;
        }

        if (filters.from && Date.parse(artifact.updatedAt) < Date.parse(filters.from)) {
          return false;
        }

        if (filters.to && Date.parse(artifact.updatedAt) > Date.parse(filters.to)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((artifact) => ({
        artifactId: artifact.artifactId,
        requestId: artifact.requestId,
        userId: artifact.userId,
        projectId: artifact.projectId,
        artifactType: artifact.artifactType,
        status: artifact.status,
        model: artifact.model,
        workflowType: artifact.workflowType,
        sessionId: artifact.sessionId ?? null,
        stepKey: artifact.stepKey ?? null,
        artifactRole: artifact.artifactRole ?? null,
        runMode: artifact.runMode ?? null,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
      }));

    const offset = typeof filters.offset === 'number' ? filters.offset : 0;
    const end = typeof filters.limit === 'number' ? offset + filters.limit : undefined;

    return filtered.slice(offset, end);
  }

  async countArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<number> {
    return [...this.artifacts.values()].filter((artifact) => {
      if (artifact.userId !== userId) {
        return false;
      }

      if (filters.type && artifact.artifactType !== filters.type) {
        return false;
      }

      if (filters.status && artifact.status !== filters.status) {
        return false;
      }

      if (filters.projectId && artifact.projectId !== filters.projectId) {
        return false;
      }

      if (filters.from && Date.parse(artifact.updatedAt) < Date.parse(filters.from)) {
        return false;
      }

      if (filters.to && Date.parse(artifact.updatedAt) > Date.parse(filters.to)) {
        return false;
      }

      return true;
    }).length;
  }

  async listArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    const filtered = [...this.artifacts.values()]
      .filter((artifact) => {
        if (artifact.userId !== userId) {
          return false;
        }

        if (filters.type && artifact.artifactType !== filters.type) {
          return false;
        }

        if (filters.status && artifact.status !== filters.status) {
          return false;
        }

        if (filters.projectId && artifact.projectId !== filters.projectId) {
          return false;
        }

        if (filters.from && Date.parse(artifact.updatedAt) < Date.parse(filters.from)) {
          return false;
        }

        if (filters.to && Date.parse(artifact.updatedAt) > Date.parse(filters.to)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((artifact) => ({
        artifactId: artifact.artifactId,
        requestId: artifact.requestId,
        userId: artifact.userId,
        projectId: artifact.projectId,
        artifactType: artifact.artifactType,
        status: artifact.status,
        model: artifact.model,
        workflowType: artifact.workflowType,
        sessionId: artifact.sessionId ?? null,
        stepKey: artifact.stepKey ?? null,
        artifactRole: artifact.artifactRole ?? null,
        runMode: artifact.runMode ?? null,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
      }));

    const offset = typeof filters.offset === 'number' ? filters.offset : 0;
    const end = typeof filters.limit === 'number' ? offset + filters.limit : undefined;

    return filtered.slice(offset, end);
  }

  async listRecentCompletedArtifactsForToolByUser(
    userId: string,
    input: { projectId: string; workflowType: string; limit: number },
  ): Promise<ArtifactSummary[]> {
    const limit = Number.isFinite(input.limit) && input.limit > 0
      ? Math.trunc(input.limit)
      : 0;

    if (limit <= 0) {
      return [];
    }

    return [...this.artifacts.values()]
      .filter((artifact) => {
        return artifact.userId === userId
          && artifact.projectId === input.projectId
          && artifact.status === 'completed'
          && artifact.workflowType === input.workflowType;
      })
      .sort((left, right) => {
        if (left.updatedAt === right.updatedAt) {
          return right.artifactId.localeCompare(left.artifactId);
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .slice(0, limit)
      .map((artifact) => ({
        artifactId: artifact.artifactId,
        requestId: artifact.requestId,
        userId: artifact.userId,
        projectId: artifact.projectId,
        artifactType: artifact.artifactType,
        status: artifact.status,
        model: artifact.model,
        workflowType: artifact.workflowType,
        sessionId: artifact.sessionId ?? null,
        stepKey: artifact.stepKey ?? null,
        artifactRole: artifact.artifactRole ?? null,
        runMode: artifact.runMode ?? null,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
      }));
  }

  async getArtifactByIdForUser(
    userId: string,
    artifactId: string,
    projection: ArtifactReadProjection = {},
  ): Promise<ArtifactDetail | null> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact || artifact.userId !== userId) {
      return null;
    }

    return this.mapToDetail(artifact, projection);
  }

  async getArtifactsByIdsForUser(
    userId: string,
    artifactIds: string[],
    projection: ArtifactReadProjection = {},
  ): Promise<ArtifactDetail[]> {
    if (artifactIds.length === 0) {
      return [];
    }

    return artifactIds
      .map((artifactId) => this.artifacts.get(artifactId))
      .filter((artifact): artifact is StubArtifactQueryRecord => {
        return artifact !== undefined && artifact.userId === userId;
      })
      .map((artifact) => this.mapToDetail(artifact, projection));
  }

  async getArtifactById(
    artifactId: string,
    projection: ArtifactReadProjection = {},
  ): Promise<ArtifactDetail | null> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      return null;
    }

    return this.mapToDetail(artifact, projection);
  }

  async listArtifactDetailsBySession(
    userId: string,
    sessionId: string,
    projection: ArtifactReadProjection = {},
  ): Promise<ArtifactDetail[]> {
    return [...this.artifacts.values()]
      .filter((artifact) => artifact.userId === userId && artifact.sessionId === sessionId)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map((artifact) => this.mapToDetail(artifact, projection));
  }

  async getArtifactDetailBySessionStep(
    userId: string,
    sessionId: string,
    stepKey: string,
    projection: ArtifactReadProjection = {},
  ): Promise<ArtifactDetail | null> {
    const readStepFromInput = (artifact: StubArtifactQueryRecord): string | null => {
      const toolWorkflow = artifact.input?.toolWorkflow;
      if (toolWorkflow && typeof toolWorkflow === 'object' && !Array.isArray(toolWorkflow)) {
        const toolWorkflowStep = (toolWorkflow as { stepKey?: unknown }).stepKey;
        if (typeof toolWorkflowStep === 'string' && toolWorkflowStep.trim().length > 0) {
          return toolWorkflowStep.trim();
        }
      }

      const directStep = artifact.input?.step;
      if (typeof directStep === 'string' && directStep.trim().length > 0) {
        return directStep.trim();
      }

      return null;
    };

    const match = [...this.artifacts.values()]
      .filter((artifact) => artifact.userId === userId && artifact.sessionId === sessionId)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .find((artifact) => {
        const resolvedStepKey = artifact.stepKey ?? readStepFromInput(artifact);
        return resolvedStepKey === stepKey;
      });

    return match ? this.mapToDetail(match, projection) : null;
  }

  async listSessionSummaries(
    userId: string,
    projectId: string | null,
    options: { limit?: number; cursor?: SessionListCursor | null } = {},
  ): Promise<SessionListPage> {
    const bySession = new Map<string, {
      projectId: string;
      toolKey: string | null;
      status: 'generating' | 'completed' | 'failed';
      count: number;
      updatedAtMs: number;
    }>();

    for (const artifact of this.artifacts.values()) {
      if (artifact.userId !== userId) continue;
      const sessionId = artifact.sessionId?.trim();
      if (!sessionId) continue;
      if (projectId && artifact.projectId !== projectId) continue;

      const updatedAtMs = Date.parse(artifact.updatedAt);
      const existing = bySession.get(sessionId);
      if (existing) {
        existing.count += 1;
        if (updatedAtMs > existing.updatedAtMs) existing.updatedAtMs = updatedAtMs;
        if (artifact.status === 'generating') {
          existing.status = 'generating';
        } else if (artifact.status === 'failed' && existing.status !== 'generating') {
          existing.status = 'failed';
        }
      } else {
        bySession.set(sessionId, {
          projectId: artifact.projectId,
          toolKey: normalizeToolWorkflowKey(artifact.workflowType),
          status: artifact.status,
          count: 1,
          updatedAtMs,
        });
      }
    }

    const sorted = [...bySession.entries()]
      .map(([sessionId, data]) => ({
        sessionId,
        projectId: data.projectId,
        toolKey: data.toolKey,
        status: data.status,
        artifactCount: data.count,
        updatedAt: new Date(data.updatedAtMs).toISOString(),
      }))
      .sort((a, b) => {
        const byUpdatedAt = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        if (byUpdatedAt !== 0) {
          return byUpdatedAt;
        }

        return b.sessionId.localeCompare(a.sessionId);
      });

    const limit = Number.isFinite(options.limit) && (options.limit ?? 0) > 0
      ? Math.trunc(options.limit as number)
      : 500;
    const cursor = options.cursor ?? null;

    const filtered = cursor
      ? sorted.filter((entry) => {
        const entryUpdatedAtMs = Date.parse(entry.updatedAt);
        const cursorUpdatedAtMs = Date.parse(cursor.updatedAt);
        if (entryUpdatedAtMs < cursorUpdatedAtMs) {
          return true;
        }
        if (entryUpdatedAtMs > cursorUpdatedAtMs) {
          return false;
        }

        return entry.sessionId < cursor.sessionId;
      })
      : sorted;

    const pageSlice = filtered.slice(0, limit + 1);
    const hasMore = pageSlice.length > limit;
    const pageEntries = hasMore ? pageSlice.slice(0, limit) : pageSlice;
    const last = pageEntries[pageEntries.length - 1];

    return {
      entries: pageEntries,
      nextCursor: hasMore && last
        ? { updatedAt: last.updatedAt, sessionId: last.sessionId }
        : null,
    };
  }

  seed(records: StubArtifactQueryRecord[]): void {
    records.forEach((record) => this.artifacts.set(record.artifactId, record));
  }
}

export type PostgresRedisStubOptions = {
  defaultQuotaLimit?: number;
  runtime?: ProductionAdapterRuntime;
};

export const createPostgresRedisStubDependencies = (
  options: PostgresRedisStubOptions = {},
): PostgresRedisAdapterDependencies => {
  const { defaultQuotaLimit = 100, runtime } = options;
  const llm: LlmStreamAdapter = createSyntheticLlmStreamAdapter();
  const generate: LlmGenerateAdapter = createSyntheticLlmGenerateAdapter();

  const deps: PostgresRedisAdapterDependencies = {
    ownership: new ProjectOwnershipRepositoryStub(),
    quota: new RedisQuotaRepositoryStub(defaultQuotaLimit),
    idempotency: new RedisIdempotencyRepositoryStub(),
    stream: new RedisStreamSessionRepositoryStub(runtime),
    llm,
    generate,
    persistence: new PostgresArtifactRepositoryStub(runtime),
    orchestrateCache: null,
  };
  return deps;
};

export const createPostgresRedisStubGenerationAdapters = (
  options: PostgresRedisStubOptions = {},
) => {
  const dependencies = createPostgresRedisStubDependencies(options);
  return createPostgresRedisGenerationAdapters(dependencies);
};
