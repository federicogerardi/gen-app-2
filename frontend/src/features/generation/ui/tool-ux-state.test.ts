import { describe, expect, it } from 'vitest';
import {
  deriveCanonicalToolUiState,
  derivePrimaryActionPolicy,
} from './tool-ux-state';

const baseInput = {
  phase: 'idle' as const,
  intent: 'new' as const,
  extractionLifecycle: 'idle' as const,
  hasProject: false,
  hasBriefing: false,
  hasCheckpoint: false,
  checkpointHasExtractionContext: false,
  hasSourceArtifact: false,
  streamStatus: 'idle' as const,
};

describe('tool ux canonical state', () => {
  it('returns draft-empty when prerequisites are missing', () => {
    const state = deriveCanonicalToolUiState(baseInput);
    expect(state).toBe('draft-empty');
  });

  it('returns processing-briefing while extraction is running', () => {
    const state = deriveCanonicalToolUiState({
      ...baseInput,
      hasProject: true,
      hasBriefing: true,
      phase: 'extracting',
      extractionLifecycle: 'in_progress',
    });

    expect(state).toBe('processing-briefing');
  });

  it('returns draft-ready when setup and extraction are ready', () => {
    const state = deriveCanonicalToolUiState({
      ...baseInput,
      hasProject: true,
      hasBriefing: true,
      phase: 'review',
      extractionLifecycle: 'completed_full',
    });

    expect(state).toBe('draft-ready');
  });

  it('returns resume-needs-briefing when resume has checkpoint without briefing', () => {
    const state = deriveCanonicalToolUiState({
      ...baseInput,
      intent: 'resume',
      hasCheckpoint: true,
      hasBriefing: false,
      checkpointHasExtractionContext: false,
    });

    expect(state).toBe('resume-needs-briefing');
  });

  it('returns paused-with-checkpoint when resume has briefing and checkpoint', () => {
    const state = deriveCanonicalToolUiState({
      ...baseInput,
      intent: 'resume',
      hasCheckpoint: true,
      hasBriefing: true,
      checkpointHasExtractionContext: true,
      hasProject: true,
      phase: 'review',
      extractionLifecycle: 'completed_partial',
    });

    expect(state).toBe('paused-with-checkpoint');
  });

  it('returns paused-with-checkpoint when resume checkpoint has extraction context even without briefing', () => {
    const state = deriveCanonicalToolUiState({
      ...baseInput,
      intent: 'resume',
      hasCheckpoint: true,
      hasBriefing: false,
      checkpointHasExtractionContext: true,
      hasProject: true,
    });

    expect(state).toBe('paused-with-checkpoint');
  });

  it('returns prefilled-regenerate when regenerate has source artifact', () => {
    const state = deriveCanonicalToolUiState({
      ...baseInput,
      intent: 'regenerate',
      hasSourceArtifact: true,
      hasProject: true,
      hasBriefing: true,
      phase: 'review',
      extractionLifecycle: 'completed_full',
    });

    expect(state).toBe('prefilled-regenerate');
  });

  it('returns running during active streaming', () => {
    const state = deriveCanonicalToolUiState({
      ...baseInput,
      streamStatus: 'streaming',
      hasProject: true,
      hasBriefing: true,
      phase: 'generating',
    });

    expect(state).toBe('running');
  });

  it('returns completed after terminal success', () => {
    const state = deriveCanonicalToolUiState({
      ...baseInput,
      streamStatus: 'completed',
    });

    expect(state).toBe('completed');
  });
});

describe('tool ux primary action policy', () => {
  it('maps draft-ready to start-generation', () => {
    expect(derivePrimaryActionPolicy('draft-ready')).toBe('start-generation');
  });

  it('maps paused-with-checkpoint to resume-checkpoint', () => {
    expect(derivePrimaryActionPolicy('paused-with-checkpoint')).toBe('resume-checkpoint');
  });

  it('maps completed to open-last-artifact', () => {
    expect(derivePrimaryActionPolicy('completed')).toBe('open-last-artifact');
  });

  it('disables primary action while running', () => {
    expect(derivePrimaryActionPolicy('running')).toBe('disabled');
  });
});
