import { describe, expect, it } from 'vitest';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import {
  normalizeHydrateRequest,
  normalizePendingHydration,
  readHydrationMachineOutput,
} from './tool-page-hydration';

describe('tool-page-hydration', () => {
  it('maps done payload to success or error output deterministically', () => {
    const success = readHydrationMachineOutput({
      output: {
        extractionArtifactId: 'artifact-1',
        extractionPayload: { topic: 'x' },
        briefingId: 'brief_1',
        briefingFileName: null,
        normalizedText: 'brief text',
        parsedFormat: 'md',
      },
    });

    expect(success).toEqual({
      status: 'success',
      hydration: {
        extractionArtifactId: 'artifact-1',
        extractionPayload: { topic: 'x' },
        briefingId: 'brief_1',
        briefingFileName: null,
        normalizedText: 'brief text',
        parsedFormat: 'md',
      },
    });

    const explicitError = readHydrationMachineOutput({ output: { status: 'error', reason: 'boom' } });
    expect(explicitError).toEqual({ status: 'error', reason: 'boom' });

    const fallbackError = readHydrationMachineOutput({ output: { invalid: true } });
    expect(fallbackError).toEqual({ status: 'error', reason: 'hydration_failed' });
  });

  it('normalizeHydrateRequest canonicalizes briefingId and preserves exact output fields', () => {
    const localArtifacts = [{ artifactId: 'a-1' }] as GenerationArtifact[];
    const normalized = normalizeHydrateRequest({
      sourceArtifactId: 'source-1',
      intent: 'resume',
      resolvedBriefingId: 'legacy-brief-id',
      sourceExtractionArtifactId: 'extract-1',
      localArtifacts,
    });

    expect(normalized).toEqual({
      sourceArtifactId: 'source-1',
      intent: 'resume',
      resolvedBriefingId: null,
      sourceExtractionArtifactId: 'extract-1',
      localArtifacts,
    });

    expect(Object.keys(normalized)).toEqual([
      'sourceArtifactId',
      'intent',
      'resolvedBriefingId',
      'sourceExtractionArtifactId',
      'localArtifacts',
    ]);
  });

  it('normalizePendingHydration applies fallback intent and default empty fields', () => {
    expect(normalizePendingHydration(null, 'regenerate')).toEqual({
      sourceArtifactId: null,
      intent: 'regenerate',
      resolvedBriefingId: null,
      sourceExtractionArtifactId: null,
      localArtifacts: [],
    });

    expect(normalizePendingHydration({
      sourceArtifactId: 'source-2',
      intent: 'new',
      resolvedBriefingId: 'brief_123',
      sourceExtractionArtifactId: 'extract-2',
      localArtifacts: [],
    }, 'resume')).toEqual({
      sourceArtifactId: 'source-2',
      intent: 'new',
      resolvedBriefingId: 'brief_123',
      sourceExtractionArtifactId: 'extract-2',
      localArtifacts: [],
    });
  });
});
