import type {
  IdempotencyCoordinatorInput,
  PersistenceBatchInput,
  StreamTransportInput,
  UsageActorInput,
} from '../types/xstate';

import type {
  IdempotencyDecision,
  LlmStreamAdapter,
  PersistedArtifactStatus,
  UsageDecision,
} from './generation.adapters';
import { createSyntheticLlmStreamAdapter } from './generation.adapters';
import { createPostgresRedisGenerationAdapters } from './postgres-redis.adapters';
import type {
  PostgresArtifactRepository,
  PostgresRedisAdapterDependencies,
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
  status: PersistedArtifactStatus;
  content: string;
  updatedAt: string;
};

const toIsoNow = (runtime?: ProductionAdapterRuntime): string =>
  (runtime?.now ?? (() => new Date()))().toISOString();

const createRandomId = (runtime?: ProductionAdapterRuntime): string => {
  return runtime?.randomId?.() ?? Math.random().toString(36).slice(2, 12);
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
