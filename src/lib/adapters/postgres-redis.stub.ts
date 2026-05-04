import type {
  IdempotencyCoordinatorInput,
  PersistenceBatchInput,
  StreamTransportInput,
  UsageActorInput,
} from '../types/xstate';

import type {
  IdempotencyDecision,
  LlmStreamAdapter,
  UsageDecision,
} from './generation.adapters';
import { createSyntheticLlmStreamAdapter } from './generation.adapters';
import type { ArtifactStatus } from '../types/artifact';
import { createPostgresRedisGenerationAdapters } from './postgres-redis.adapters';
import type {
  ArtifactDetail,
  ArtifactListFilters,
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
  ProjectQueryRepository,
  ProductionAdapterRuntime,
  RedisIdempotencyRepository,
  RedisQuotaRepository,
  RedisStreamSessionRepository,
} from './postgres-redis.interfaces';

type StubQuotaBucket = {
  limit: number;
  used: number;
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
  workflowType: string | null;
  input: Record<string, unknown>;
  content: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export class RedisQuotaRepositoryStub implements RedisQuotaRepository {
  private readonly buckets = new Map<string, StubQuotaBucket>();

  constructor(private readonly defaultQuotaLimit = 100) {}

  async claimUsage(input: UsageActorInput): Promise<UsageDecision> {
    const current = this.buckets.get(input.userId) ?? {
      limit: this.defaultQuotaLimit,
      used: 0,
    };

    if (current.used >= current.limit) {
      return { granted: false, reason: 'quota_exhausted' };
    }

    current.used += 1;
    this.buckets.set(input.userId, current);
    return { granted: true };
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
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.projects.set(id, record);

    return {
      id,
      userId,
      name: record.name,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export class ArtifactQueryRepositoryStub implements ArtifactQueryRepository {
  private readonly artifacts = new Map<string, StubArtifactQueryRecord>();

  async listArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    return [...this.artifacts.values()]
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
        projectId: artifact.projectId,
        artifactType: artifact.artifactType,
        status: artifact.status,
        model: artifact.model,
        workflowType: artifact.workflowType,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
      }));
  }

  async getArtifactByIdForUser(userId: string, artifactId: string): Promise<ArtifactDetail | null> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact || artifact.userId !== userId) {
      return null;
    }

    return {
      artifactId: artifact.artifactId,
      requestId: artifact.requestId,
      userId: artifact.userId,
      projectId: artifact.projectId,
      artifactType: artifact.artifactType,
      status: artifact.status,
      model: artifact.model,
      workflowType: artifact.workflowType,
      input: artifact.input,
      content: artifact.content,
      failureReason: artifact.failureReason,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
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

  return {
    quota: new RedisQuotaRepositoryStub(defaultQuotaLimit),
    idempotency: new RedisIdempotencyRepositoryStub(),
    stream: new RedisStreamSessionRepositoryStub(runtime),
    llm,
    persistence: new PostgresArtifactRepositoryStub(runtime),
  };
};

export const createPostgresRedisStubGenerationAdapters = (
  options: PostgresRedisStubOptions = {},
) => {
  const dependencies = createPostgresRedisStubDependencies(options);
  return createPostgresRedisGenerationAdapters(dependencies);
};
