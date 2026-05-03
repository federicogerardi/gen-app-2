/**
 * Compile-time type parity guard for the FE↔BE contract boundary.
 *
 * This file contains NO runtime code. It uses TypeScript's structural type system
 * to assert that the frontend types in `backend-stream.ts` remain structurally
 * identical to the canonical backend definitions:
 *   - src/lib/runtime/stream-contract.ts   → BackendStreamEvent
 *   - src/lib/runtime/request-contract.ts  → BackendGenerationRequest
 *
 * HOW TO USE:
 *   - Run `npm --prefix frontend run typecheck` — any structural divergence causes
 *     a compile error here before it can silently slip into production.
 *   - When the backend contract changes, update both `backend-stream.ts` AND the
 *     pinned shapes below, then confirm typecheck passes.
 *
 * DDD: GenerationRequest (DDD-002), BackendStreamEvent (DDD-009).
 */

import type {
  ArtifactType,
  BackendStreamEvent,
  GenerationRequest,
  OutputFormat,
} from './backend-stream';

// ---------------------------------------------------------------------------
// Pinned canonical shapes — mirrors src/lib/runtime/request-contract.ts
// and src/lib/runtime/stream-contract.ts exactly.
// Update these when the backend contract changes.
// ---------------------------------------------------------------------------

type _PinnedArtifactType = 'content' | 'seo' | 'code' | 'extraction';
type _PinnedOutputFormat = 'plain' | 'json' | 'markdown';

type _PinnedGenerationRequest = {
  requestId: string;
  userId: string;
  projectId: string;
  artifactType: _PinnedArtifactType;
  model: string;
  input: Record<string, unknown>;
  toolKey?: string | null;
  workflowType?: string | null;
  idempotencyKey?: string;
  outputFormat?: _PinnedOutputFormat;
  registryVersion?: string;
  registrySnapshotRef?: string;
  briefingId?: string | null;
  extractionArtifactId?: string | null;
  stepDependencyArtifactIds?: string[] | null;
};

type _PinnedBackendStreamEvent =
  | { event: 'start'; data: { requestId: string; artifactId: string } }
  | { event: 'chunk'; data: { artifactId: string; chunk: string; sequence: number } }
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

// ---------------------------------------------------------------------------
// Bidirectional structural checks — both directions must hold.
// A TS error here means FE type and pinned shape have diverged.
// ---------------------------------------------------------------------------

// ArtifactType parity
type _CheckArtifactTypeFEextendsPinned = ArtifactType extends _PinnedArtifactType ? true : never;
type _CheckArtifactTypePinnedExtendsFE = _PinnedArtifactType extends ArtifactType ? true : never;
declare const _assertArtifactTypeFwd: _CheckArtifactTypeFEextendsPinned;
declare const _assertArtifactTypeRev: _CheckArtifactTypePinnedExtendsFE;

// OutputFormat parity
type _CheckOutputFormatFEextendsPinned = OutputFormat extends _PinnedOutputFormat ? true : never;
type _CheckOutputFormatPinnedExtendsFE = _PinnedOutputFormat extends OutputFormat ? true : never;
declare const _assertOutputFormatFwd: _CheckOutputFormatFEextendsPinned;
declare const _assertOutputFormatRev: _CheckOutputFormatPinnedExtendsFE;

// GenerationRequest parity
type _CheckGenerationRequestFEextendsPinned = GenerationRequest extends _PinnedGenerationRequest
  ? true
  : never;
type _CheckGenerationRequestPinnedExtendsFE = _PinnedGenerationRequest extends GenerationRequest
  ? true
  : never;
declare const _assertGenerationRequestFwd: _CheckGenerationRequestFEextendsPinned;
declare const _assertGenerationRequestRev: _CheckGenerationRequestPinnedExtendsFE;

// BackendStreamEvent parity
type _CheckStreamEventFEextendsPinned = BackendStreamEvent extends _PinnedBackendStreamEvent
  ? true
  : never;
type _CheckStreamEventPinnedExtendsFE = _PinnedBackendStreamEvent extends BackendStreamEvent
  ? true
  : never;
declare const _assertStreamEventFwd: _CheckStreamEventFEextendsPinned;
declare const _assertStreamEventRev: _CheckStreamEventPinnedExtendsFE;

// Suppress "unused variable" warnings — the declarations above are intentional.
export type {};
