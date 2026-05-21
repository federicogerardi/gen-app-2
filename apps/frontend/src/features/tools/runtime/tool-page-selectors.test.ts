import { describe, expect, it } from 'vitest';
import { selectToolFileInstructions } from './tool-page-selectors';

describe('selectToolFileInstructions', () => {
  it('returns canonical angle-generator instructions with the dual-source file requirement', () => {
    const instructions = selectToolFileInstructions('angle-generator');

    expect(instructions).not.toBeNull();
    expect(instructions?.requiredFiles).toEqual([
      'BriefingFile (.docx, .txt, .md)',
      'AngleDetectorFile (.docx, .txt, .md)',
    ]);
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
});