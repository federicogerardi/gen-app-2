import { describe, expect, it } from 'vitest';
import {
  buildBaseGenerationRequest,
  deriveToolInputFileCompletion,
  deriveToolInputRequirementMatrix,
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

  it('builds the canonical input requirement matrix with direct-input and file entries', () => {
    const matrix = deriveToolInputRequirementMatrix({
      toolKey: 'angle-generator',
      hasProjectSelected: false,
      completedFileKeys: [],
    });

    expect(matrix.requiredEntriesSatisfied).toBe(false);
    expect(matrix.missingRequiredEntries.map((entry) => entry.key)).toEqual([
      'project-selection',
      'briefing-file',
    ]);
    expect(matrix.missingOptionalEntries.map((entry) => entry.key)).toEqual([
      'angle-detector-file',
    ]);
  });

  it('keeps api-acquisition entries empty for current tools without bindings', () => {
    const matrix = deriveToolInputRequirementMatrix({
      toolKey: 'funnel-pages',
      hasProjectSelected: true,
      completedFileKeys: ['briefing-file'],
      apiAcquisitionStatus: [{ key: 'unused-binding', connected: true }],
    });

    expect(matrix.missingRequiredApiAcquisition).toEqual([]);
    expect(matrix.missingOptionalApiAcquisition).toEqual([]);
    expect(matrix.entries.some((entry) => entry.sourceFamily === 'api-acquisition')).toBe(false);
  });

  it('supports youtube-description direct-input policy without required file inputs', () => {
    const matrixMissingProject = deriveToolInputRequirementMatrix({
      toolKey: 'youtube-description',
      hasProjectSelected: false,
      completedFileKeys: [],
    });

    expect(matrixMissingProject.missingRequiredEntries.map((entry) => entry.key)).toEqual([
      'project-selection',
    ]);

    const matrixReady = deriveToolInputRequirementMatrix({
      toolKey: 'youtube-description',
      hasProjectSelected: true,
      completedFileKeys: [],
    });

    expect(matrixReady.requiredEntriesSatisfied).toBe(true);
    expect(matrixReady.missingRequiredFiles).toEqual([]);
  });
});

describe('buildBaseGenerationRequest', () => {
  it('injects selected campaign objective for meta-ads when extraction payload is missing it', () => {
    const request = buildBaseGenerationRequest({
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      toolKey: 'meta-ads',
      runtimeIntent: 'new',
      formState: {
        model: 'openrouter/auto',
        tone: 'Professional',
        campaignObjective: 'Leads',
        registrySnapshotRef: 'snapshot:default',
      },
      toolConfig: {
        defaultModel: 'openrouter/auto',
      },
      resolvedNotes: '',
      resolvedRelaunchSource: null,
      sourceArtifactId: null,
      resolvedBriefingId: 'brief-1',
      effectiveBriefingFileName: 'brief.md',
      extractionInfo: {
        extractionArtifactId: 'artifact-extract-1',
        extractionPayload: {
          product_or_service: 'Demo product',
          target_audience: 'SMB',
        },
        briefingId: 'brief-1',
        briefingText: 'brief text',
      },
      runPrefix: 'run-1',
    });

    expect(request.input.extractionPayload).toMatchObject({
      campaign_objective: 'Leads',
    });
  });

  it('does not overwrite existing campaign objective in extraction payload', () => {
    const request = buildBaseGenerationRequest({
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      toolKey: 'meta-ads',
      runtimeIntent: 'new',
      formState: {
        model: 'openrouter/auto',
        tone: 'Professional',
        campaignObjective: 'Traffic',
        registrySnapshotRef: 'snapshot:default',
      },
      toolConfig: {
        defaultModel: 'openrouter/auto',
      },
      resolvedNotes: '',
      resolvedRelaunchSource: null,
      sourceArtifactId: null,
      resolvedBriefingId: 'brief-1',
      effectiveBriefingFileName: 'brief.md',
      extractionInfo: {
        extractionArtifactId: 'artifact-extract-1',
        extractionPayload: {
          campaign_objective: 'Sales',
        },
        briefingId: 'brief-1',
        briefingText: 'brief text',
      },
      runPrefix: 'run-1',
    });

    expect(request.input.extractionPayload).toMatchObject({
      campaign_objective: 'Sales',
    });
  });
});