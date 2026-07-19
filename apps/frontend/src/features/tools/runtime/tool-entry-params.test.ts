import { describe, expect, it } from 'vitest';
import {
  parseOptionalString,
  parseToolEntryParams,
  parseToolIntent,
} from './tool-entry-params';

describe('tool-entry-params', () => {
  describe('parseToolIntent', () => {
    it('returns new for null or unknown values', () => {
      expect(parseToolIntent(null)).toBe('new');
      expect(parseToolIntent('')).toBe('new');
      expect(parseToolIntent('other')).toBe('new');
    });

    it('returns resume/regenerate when valid', () => {
      expect(parseToolIntent('resume')).toBe('resume');
      expect(parseToolIntent('regenerate')).toBe('regenerate');
    });
  });

  describe('parseOptionalString', () => {
    it('normalizes empty values to null', () => {
      expect(parseOptionalString(null)).toBeNull();
      expect(parseOptionalString('')).toBeNull();
      expect(parseOptionalString('   ')).toBeNull();
    });

    it('returns trimmed value for non-empty input', () => {
      expect(parseOptionalString(' abc ')).toBe('abc');
    });
  });

  describe('parseToolEntryParams', () => {
    it('returns normalized params shape', () => {
      const params = new URLSearchParams({
        intent: 'resume',
        sourceArtifactId: ' source-1 ',
        projectId: ' p-1 ',
        tone: ' direct ',
        notes: ' note ',
        relaunchFromArtifactId: ' rel-1 ',
        briefingId: ' brief-1 ',
        extractionArtifactId: ' ext-1 ',
        briefingFileName: ' file.md ',
      });

      expect(parseToolEntryParams(params)).toEqual({
        intent: 'resume',
        sourceArtifactId: 'source-1',
        initialProjectId: 'p-1',
        relaunchNotes: 'note',
        relaunchFromArtifactId: 'rel-1',
        briefingId: 'brief-1',
        extractionArtifactId: 'ext-1',
        briefingFileName: 'file.md',
      });
    });

    it('falls back to null/new when params are missing', () => {
      const params = new URLSearchParams();

      expect(parseToolEntryParams(params)).toEqual({
        intent: 'new',
        sourceArtifactId: null,
        initialProjectId: null,
        relaunchNotes: null,
        relaunchFromArtifactId: null,
        briefingId: null,
        extractionArtifactId: null,
        briefingFileName: null,
      });
    });
  });
});
