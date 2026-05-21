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
      'knowledge_content',
      'avatar',
      'pain_point',
      'purchase_process_type',
      'offer',
      'proof',
      'target_duration_minutes',
      'proprietary_methodology_disclosure',
    ]);
    expect(instructions?.requiredFields).not.toContain('tone');
    expect(instructions?.stepConstraints).toEqual([
      'La sequenza canonica è pre-script-analysis -> packaging -> intro-structure -> body-structure -> native-cta-embeds -> outro-structure.',
    ]);
  });
});