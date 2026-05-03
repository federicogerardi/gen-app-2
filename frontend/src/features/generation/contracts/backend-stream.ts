/**
 * Frontend canonical contract boundary for generation request and SSE stream events.
 * This is the single authoritative source for all frontend consumers — do not duplicate
 * these types elsewhere in frontend/src.
 *
 * Backend authoritative counterparts (structurally identical, cannot be cross-imported):
 *   - BackendStreamEvent  → src/lib/runtime/stream-contract.ts
 *   - GenerationRequest   → src/lib/runtime/request-contract.ts (BackendGenerationRequest)
 *
 * Structural parity is enforced at compile time via:
 *   frontend/src/features/generation/contracts/backend-stream.parity.guard.ts
 *
 * DDD canonical terms: GenerationRequest (DDD-002), BackendStreamEvent (DDD-009).
 */
export type ArtifactType = 'content' | 'seo' | 'code' | 'extraction';
export type OutputFormat = 'plain' | 'json' | 'markdown';

export type GenerationRequest = {
  requestId: string;
  userId: string;
  projectId: string;
  artifactType: ArtifactType;
  model: string;
  input: Record<string, unknown>;
  toolKey?: string | null;
  workflowType?: string | null;
  idempotencyKey?: string;
  outputFormat?: OutputFormat;
  registryVersion?: string;
  registrySnapshotRef?: string;
  briefingId?: string | null;
  extractionArtifactId?: string | null;
  stepDependencyArtifactIds?: string[] | null;
};

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
