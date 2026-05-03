import type {
  IdempotencyCoordinatorInput,
  LlmUsageMetrics,
  PersistenceBatchInput,
  StreamTransportInput,
  UsageActorInput,
} from '../types/xstate';
import type { ArtifactStatus } from '../types/artifact';

export type { LlmUsageMetrics };

export type LlmStreamInput = {
  requestId: string;
  model: string;
  outputFormat: StreamTransportInput['outputFormat'];
  requestInput: Record<string, unknown>;
  signal?: AbortSignal;
};

export type LlmStreamEvent =
  | { type: 'chunk'; chunk: string }
  | {
      type: 'heartbeat';
      estimatedInputTokens: number;
      estimatedOutputTokens: number;
      costEstimate: number;
    }
  | { type: 'completed'; usage?: LlmUsageMetrics };

export type UsageDecision = {
  granted: boolean;
  reason?: string;
};

export type IdempotencyDecision =
  | { status: 'claimed' }
  | { status: 'replay'; artifactId: string; content: string }
  | { status: 'conflict'; reason: string };

export type PersistedArtifactStatus = ArtifactStatus;

export interface UsageAdapter {
  claimUsage(input: UsageActorInput): Promise<UsageDecision>;
}

export interface IdempotencyAdapter {
  checkAndClaim(input: IdempotencyCoordinatorInput): Promise<IdempotencyDecision>;
  markCompleted(
    input: IdempotencyCoordinatorInput,
    artifactId: string,
    content: string,
  ): Promise<void>;
  markFailed(input: IdempotencyCoordinatorInput): Promise<void>;
}

export interface StreamAdapter {
  openSession(input: StreamTransportInput): Promise<{ sessionId: string }>;
}

export interface LlmStreamAdapter {
  streamText(input: LlmStreamInput): AsyncIterable<LlmStreamEvent>;
}

export interface PersistenceAdapter {
  flushProgress(input: PersistenceBatchInput, sequence: number): Promise<void>;
  finalizeSuccess(input: PersistenceBatchInput): Promise<void>;
  finalizeFailure(input: PersistenceBatchInput, reason: string): Promise<void>;
}

export interface GenerationAdapters {
  usage: UsageAdapter;
  idempotency: IdempotencyAdapter;
  stream: StreamAdapter;
  llm: LlmStreamAdapter;
  persistence: PersistenceAdapter;
}

type QuotaBucket = {
  limit: number;
  used: number;
};

type IdempotencyRecord = {
  status: 'in_progress' | 'completed' | 'failed';
  artifactId: string | null;
  content: string;
};

type ArtifactRecord = {
  status: ArtifactStatus;
  content: string;
  updatedAt: string;
};

const nowIso = (): string => new Date().toISOString();

const buildSyntheticResponse = (input: LlmStreamInput): string => {
  // For extraction requests, return the extraction payload as JSON
  const extractionPayload = input.requestInput.extractionPayload;
  if (extractionPayload && typeof extractionPayload === 'object') {
    return JSON.stringify(extractionPayload, null, 2);
  }

  // For other requests, use the prompt
  const prompt = input.requestInput.prompt;
  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    return `Generated output for prompt: ${prompt.trim()}`;
  }

  return `Generated output for request ${input.requestId}`;
};
export const createSyntheticLlmStreamAdapter = (): LlmStreamAdapter => ({
  async *streamText(input) {
    const content = buildSyntheticResponse(input);
    if (content.length > 0) {
      yield { type: 'chunk', chunk: content };
    }

    yield {
      type: 'completed',
      usage: {
        inputTokens: Math.max(0, Math.ceil(JSON.stringify(input.requestInput).length / 4)),
        outputTokens: Math.max(0, Math.ceil(content.length / 4)),
        costUsd: Number((Math.max(1, content.length) * 0.000001).toFixed(6)),
      },
    };
  },
});

export const createInMemoryGenerationAdapters = (
  quotaLimit = 100,
): GenerationAdapters => {
  const quotaByUser = new Map<string, QuotaBucket>();
  const idempotencyStore = new Map<string, IdempotencyRecord>();
  const artifactStore = new Map<string, ArtifactRecord>();

  const usage: UsageAdapter = {
    async claimUsage(input) {
      const bucket = quotaByUser.get(input.userId) ?? { limit: quotaLimit, used: 0 };
      if (bucket.used >= bucket.limit) {
        return { granted: false, reason: 'quota_exhausted' };
      }
      bucket.used += 1;
      quotaByUser.set(input.userId, bucket);
      return { granted: true };
    },
  };

  const idempotency: IdempotencyAdapter = {
    async checkAndClaim(input) {
      const existing = idempotencyStore.get(input.idempotencyKey);
      if (!existing) {
        idempotencyStore.set(input.idempotencyKey, {
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
    },
    async markCompleted(input, artifactId, content) {
      idempotencyStore.set(input.idempotencyKey, {
        status: 'completed',
        artifactId,
        content,
      });
    },
    async markFailed(input) {
      const existing = idempotencyStore.get(input.idempotencyKey);
      if (!existing) {
        return;
      }
      idempotencyStore.set(input.idempotencyKey, {
        ...existing,
        status: 'failed',
      });
    },
  };

  const stream: StreamAdapter = {
    async openSession(input) {
      return {
        sessionId: `${input.requestId}:${input.artifactId}:${Date.now()}`,
      };
    },
  };

  const llm = createSyntheticLlmStreamAdapter();

  const persistence: PersistenceAdapter = {
    async flushProgress(input, _sequence) {
      const current = artifactStore.get(input.artifactId);
      artifactStore.set(input.artifactId, {
        status: 'generating',
        content: input.contentBuffer,
        updatedAt: nowIso(),
        ...current,
      });
    },
    async finalizeSuccess(input) {
      artifactStore.set(input.artifactId, {
        status: 'completed',
        content: input.contentBuffer,
        updatedAt: nowIso(),
      });
    },
    async finalizeFailure(input, reason) {
      const current = artifactStore.get(input.artifactId);
      artifactStore.set(input.artifactId, {
        status: 'failed',
        content: current?.content ?? input.contentBuffer,
        updatedAt: `${nowIso()}#${reason}`,
      });
    },
  };

  return {
    usage,
    idempotency,
    stream,
    llm,
    persistence,
  };
};
