import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import {
  toCanonicalBriefingId,
  type HydrationMachineOutput,
  type HydrationResult,
  type PendingHydration,
} from './hydration.machine';

export type HydrationIntent = 'new' | 'resume' | 'regenerate';

type NormalizeHydrateRequestInput = {
  sourceArtifactId?: string | null;
  intent: HydrationIntent;
  resolvedBriefingId?: string | null;
  sourceExtractionArtifactId?: string | null;
  localArtifacts?: GenerationArtifact[];
};

export const readDoneEventPayload = (event: unknown): unknown => {
  const doneEvent = event as { output?: unknown; data?: unknown; result?: unknown } | undefined;
  return doneEvent?.output ?? doneEvent?.data ?? doneEvent?.result ?? event;
};

export const readHydrationMachineOutput = (event: unknown): HydrationMachineOutput => {
  const output = readDoneEventPayload(event);
  if (output && typeof output === 'object' && 'status' in output) {
    return output as HydrationMachineOutput;
  }

  if (
    output
    && typeof output === 'object'
    && 'extractionArtifactId' in output
    && 'briefingId' in output
    && 'normalizedText' in output
  ) {
    return {
      status: 'success',
      hydration: output as HydrationResult,
    };
  }

  return {
    status: 'error',
    reason: 'hydration_failed',
  };
};

export const normalizeHydrateRequest = (
  input: NormalizeHydrateRequestInput,
): PendingHydration => {
  return {
    sourceArtifactId: input.sourceArtifactId ?? null,
    intent: input.intent,
    resolvedBriefingId: toCanonicalBriefingId(input.resolvedBriefingId),
    sourceExtractionArtifactId: input.sourceExtractionArtifactId ?? null,
    localArtifacts: input.localArtifacts ?? [],
  };
};

export const normalizePendingHydration = (
  input: PendingHydration | null,
  fallbackIntent: HydrationIntent,
): PendingHydration => {
  return {
    sourceArtifactId: input?.sourceArtifactId ?? null,
    intent: input?.intent ?? fallbackIntent,
    resolvedBriefingId: toCanonicalBriefingId(input?.resolvedBriefingId ?? null),
    sourceExtractionArtifactId: input?.sourceExtractionArtifactId ?? null,
    localArtifacts: input?.localArtifacts ?? [],
  };
};
