import { describe, expect, it } from 'vitest';
import {
  deriveToolInputFileCompletion,
  selectToolFileInstructions,
} from './tool-page-selectors';

describe('selectToolFileInstructions', () => {
  it('returns canonical angle-generator instructions with optional second file policy', () => {
    const instructions = selectToolFileInstructions('angle-generator');

    expect(instructions).not.toBeNull();
    expect(instructions?.alwaysRequiredFiles.map((file) => file.label)).toEqual(['BriefingFile']);
    expect(instructions?.requiredBySettingFiles).toEqual([]);
    expect(instructions?.optionalBySettingFiles.map((file) => file.label)).toEqual(['AngleDetectorFile']);
    expect(instructions?.stepConstraints).toEqual([
      'La sequenza canonica è context-and-angle-matrix -> angle-prioritization -> creative-activation.',
    ]);
  });

  it('returns canonical youtube-lf-script instructions with the full extraction schema', () => {
    const instructions = selectToolFileInstructions('youtube-lf-script');

    expect(instructions).not.toBeNull();
    expect(instructions?.requiredFields).toEqual([
      'Knowledge content',
      'Avatar',
      'Pain point',
      'Purchase process type',
      'Offerta',
      'Proof',
      'Target duration (minutes)',
      'Proprietary methodology disclosure',
    ]);
    expect(instructions?.requiredFields).not.toContain('knowledge_content');
    expect(instructions?.requiredFields).not.toContain('target_duration_minutes');
    expect(instructions?.stepConstraints).toEqual([
      'La sequenza canonica è pre-script-analysis -> packaging -> intro-structure -> body-structure -> native-cta-embeds -> outro-structure.',
    ]);
  });

  it('projects labels for funnel-pages without leaking raw key tokens', () => {
    const instructions = selectToolFileInstructions('funnel-pages');

    expect(instructions).not.toBeNull();
    expect(instructions?.requiredFields).toEqual([
      'Obiettivo del funnel',
      'Target',
      'Offerta',
      'Proof',
      'CTA principale',
    ]);
    expect(instructions?.requiredFields).not.toContain('funnel_goal');
    expect(instructions?.requiredFields).not.toContain('primary_cta');
  });

  it('derives required and optional completion deterministically from policy keys', () => {
    const angleMissingSecondOptional = deriveToolInputFileCompletion({
      toolKey: 'angle-generator',
      completedFileKeys: ['briefing-file'],
    });

    expect(angleMissingSecondOptional.requiredFilesComplete).toBe(true);
    expect(angleMissingSecondOptional.missingRequiredFiles).toEqual([]);
    expect(angleMissingSecondOptional.missingOptionalFiles.map((file) => file.key)).toEqual(['angle-detector-file']);

    const angleAllRequiredComplete = deriveToolInputFileCompletion({
      toolKey: 'angle-generator',
      completedFileKeys: ['briefing-file', 'angle-detector-file'],
    });

    expect(angleAllRequiredComplete.requiredFilesComplete).toBe(true);
    expect(angleAllRequiredComplete.missingRequiredFiles).toEqual([]);
  });
});