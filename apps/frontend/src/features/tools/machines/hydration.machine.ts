import { fromPromise } from 'xstate';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { readExtractionPayloadFromArtifact } from '../../generation/runtime/step-hydration';

export type HydrationResult = {
  extractionArtifactId: string;
  extractionPayload: Record<string, unknown>;
  briefingId: string;
  briefingFileName: string | null;
  normalizedText: string;
  parsedFormat: 'txt' | 'md' | 'docx';
};

export type PendingHydration = {
  sourceArtifactId: string | null;
  intent: 'new' | 'resume' | 'regenerate';
  resolvedBriefingId: string | null;
  sourceExtractionArtifactId: string | null;
  localArtifacts: GenerationArtifact[];
};

type HydrationMachineInput = {
  request: PendingHydration;
  projectId: string;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
};

export type HydrationMachineOutput =
  | { status: 'success'; hydration: HydrationResult }
  | { status: 'error'; reason: string };

const readErrorReason = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'hydration_failed';
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const toCanonicalBriefingId = (value: unknown): string | null => {
  const normalized = toNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return normalized.startsWith('brief_') ? normalized : null;
};

const readNormalizedBriefingText = (input: Record<string, unknown> | undefined): string => {
  if (typeof input?.briefingText === 'string' && input.briefingText.trim().length > 0) {
    return input.briefingText;
  }

  if (typeof input?.normalizedText === 'string' && input.normalizedText.trim().length > 0) {
    return input.normalizedText;
  }

  return '';
};

const assertCompleteHydrationResult = (hydrationResult: HydrationResult): HydrationResult => {
  const isComplete = hydrationResult.extractionArtifactId.trim().length > 0
    && hydrationResult.briefingId.trim().length > 0
    && hydrationResult.normalizedText.trim().length > 0;

  if (!isComplete) {
    throw new Error('incomplete_extraction_context');
  }

  return hydrationResult;
};

const hydrateExtractionContext = async (input: HydrationMachineInput): Promise<HydrationResult> => {
  const {
    request,
    projectId,
    apiBaseUrl,
  } = input;

  const {
    sourceArtifactId,
    intent,
    resolvedBriefingId,
    sourceExtractionArtifactId,
    localArtifacts,
  } = request;

  if (localArtifacts.length > 0) {
    const byExtractionId = sourceExtractionArtifactId
      ? localArtifacts.find((a) => a.artifactId === sourceExtractionArtifactId)
      : null;
    const bySourceAsExtraction = !byExtractionId && sourceArtifactId
      ? localArtifacts.find((a) => a.artifactId === sourceArtifactId && a.artifactType === 'extraction')
      : null;
    const extractionArtifact = byExtractionId ?? bySourceAsExtraction;

    if (extractionArtifact) {
      const payload = readExtractionPayloadFromArtifact(extractionArtifact);
      const sourceInput = extractionArtifact.sourceRequest?.input as Record<string, unknown> | undefined;
      const normalizedText = readNormalizedBriefingText(sourceInput);

      if (normalizedText.trim().length > 0 || Object.keys(payload).length > 0) {
        return assertCompleteHydrationResult({
          extractionArtifactId: extractionArtifact.artifactId,
          extractionPayload: payload,
          briefingId: typeof sourceInput?.briefingId === 'string'
            ? sourceInput.briefingId
            : (resolvedBriefingId ?? ''),
          briefingFileName: null,
          normalizedText,
          parsedFormat: 'md',
        });
      }

      console.log('[toolPageMachine] local extraction artifact has no text/payload, falling through to network hydration', {
        extractionArtifactId: extractionArtifact.artifactId,
      });
    }
  }

  const res = await fetch(`${apiBaseUrl}/api/tools/hydrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      projectId,
      ...(sourceArtifactId ? { sourceArtifactId } : {}),
      ...(resolvedBriefingId ? { resolvedBriefingId } : {}),
      ...(sourceExtractionArtifactId ? { sourceExtractionArtifactId } : {}),
      intent,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
    throw new Error(errData?.error?.message ?? errData?.error?.code ?? 'hydration_failed');
  }

  const resData = await res.json() as { ok: boolean; data: { hydration: HydrationResult } };
  return assertCompleteHydrationResult({
    ...resData.data.hydration,
    briefingFileName: null,
  });
};

export const hydrationMachine = fromPromise(async ({ input }: { input: HydrationMachineInput }): Promise<HydrationMachineOutput> => {
  try {
    const hydration = await hydrateExtractionContext(input);
    return { status: 'success', hydration };
  } catch (error) {
    return { status: 'error', reason: readErrorReason(error) };
  }
});
