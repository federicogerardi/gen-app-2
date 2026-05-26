import { describe, expect, it, vi } from 'vitest';
import type { ActorRefFrom } from 'xstate';
import { briefingUploadMachine } from './briefing-upload.machine';
import {
  buildReadinessSnapshot,
  deriveHasExtractionContext,
  deriveHasPrimaryTargetStep,
} from './tool-page-readiness';

describe('tool-page-readiness', () => {
  it('buildReadinessSnapshot returns deterministic reason-code matrix', () => {
    expect(buildReadinessSnapshot('project-1', true, true)).toEqual({
      canStartFlow: true,
      hasProject: true,
      hasExtractionContext: true,
      hasPrimaryTargetStep: true,
      reasonCodes: [],
    });

    expect(buildReadinessSnapshot('', false, false)).toEqual({
      canStartFlow: false,
      hasProject: false,
      hasExtractionContext: false,
      hasPrimaryTargetStep: false,
      reasonCodes: [
        'missing_project',
        'missing_extraction_context',
        'missing_primary_target_step',
      ],
    });

    expect(buildReadinessSnapshot('project-1', false, true).reasonCodes).toEqual([
      'missing_extraction_context',
    ]);
  });

  it('deriveHasPrimaryTargetStep reflects tool step availability', () => {
    expect(deriveHasPrimaryTargetStep('funnel-pages')).toBe(true);
    expect(deriveHasPrimaryTargetStep('nextland')).toBe(true);
    expect(deriveHasPrimaryTargetStep('youtube-lf-script')).toBe(true);
  });

  it('marks direct-input-only tools as extraction-context-ready by policy', () => {
    expect(deriveHasExtractionContext('youtube-description', null, null)).toBe(true);
  });

  it('does not emit sensitive logs when production-path logging is disabled', async () => {
    (globalThis as Record<string, unknown>).__TOOL_PAGE_READINESS_LOGGING_ENABLED__ = false;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const briefingActorRef = {
      getSnapshot: () => ({
        matches: (state: string) => state === 'ready',
        context: {
          extractionArtifactId: 'artifact-invalid',
          extractionPayload: {},
          briefingId: 'brief-invalid',
          normalizedText: 'normalized text that must never be logged in production',
        },
      }),
    } as unknown as ActorRefFrom<typeof briefingUploadMachine>;

    const result = deriveHasExtractionContext('nextland', briefingActorRef, null);

    expect(result).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();

    delete (globalThis as Record<string, unknown>).__TOOL_PAGE_READINESS_LOGGING_ENABLED__;
  });
});
