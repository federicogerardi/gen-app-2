import { describe, expect, it } from 'vitest';
import {
  buildBaseGenerationRequest,
  buildGeometricDirectInputExtractionInfo,
  buildYoutubeDescriptionDirectInputExtractionInfo,
  deriveToolInputRequirementMatrix,
  selectToolFileInstructions,
} from './tool-page-selectors';

describe('selectToolFileInstructions', () => {
  it('returns canonical youtube-lf-script instructions with the full extraction schema', () => {
    const instructions = selectToolFileInstructions('youtube-lf-script');

    expect(instructions).not.toBeNull();
    expect(instructions?.requiredFields).toEqual([
      'Knowledge content',
      'Avatar',
      'Pain point',
      'Purchase process type',
      'Offer',
      'Proof',
      'Target duration (minutes)',
      'Proprietary methodology disclosure',
    ]);
    expect(instructions?.requiredFields).not.toContain('knowledge_content');
    expect(instructions?.requiredFields).not.toContain('target_duration_minutes');
    expect(instructions?.stepConstraints).toEqual([
      'The canonical sequence is pre-script-analysis -> packaging -> intro-structure -> body-structure -> native-cta-embeds -> outro-structure.',
    ]);
  });

  it('projects labels for funnel-pages without leaking raw key tokens', () => {
    const instructions = selectToolFileInstructions('funnel-pages');

    expect(instructions).not.toBeNull();
    expect(instructions?.requiredFields).toEqual([
      'Funnel goal',
      'Target',
      'Offer',
      'Proof',
      'Primary CTA',
    ]);
    expect(instructions?.requiredFields).not.toContain('funnel_goal');
    expect(instructions?.requiredFields).not.toContain('primary_cta');
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

  it('maps youtube-description required direct fields to canonical seven-field set', () => {
    const instructions = selectToolFileInstructions('youtube-description');

    expect(instructions).not.toBeNull();
    expect(instructions?.requiredFields).toEqual([
      'Video title',
      'Topic',
      'Keywords',
      'CTA text',
      'CTA link',
      'Credentials or proof',
      'Chapters with timestamps',
    ]);
    expect(instructions?.optionalFields).toContain('Social links');
    expect(instructions?.optionalFields).toContain('Hashtags');
  });
});

describe('buildYoutubeDescriptionDirectInputExtractionInfo', () => {
  it('builds extraction info with canonical required fields only', () => {
    const result = buildYoutubeDescriptionDirectInputExtractionInfo({
      videoTitle: 'Title',
      topic: 'Topic',
      keywords: 'kw1,kw2',
      ctaText: 'Do this',
      ctaLink: 'https://example.com',
      credentialsOrProof: 'Proof',
      chaptersWithTimestamps: '0:00 Intro\n1:00 Body',
      socialLinks: '',
      hashtags: '',
    });

    expect(result).not.toBeNull();
    expect(result?.extractionPayload).not.toHaveProperty('socialLinks');
    expect(result?.extractionPayload).not.toHaveProperty('hashtags');
  });

  it('returns null when one canonical required field is missing', () => {
    const result = buildYoutubeDescriptionDirectInputExtractionInfo({
      videoTitle: 'Title',
      topic: 'Topic',
      keywords: 'kw1,kw2',
      ctaText: '',
      ctaLink: 'https://example.com',
      credentialsOrProof: 'Proof',
      chaptersWithTimestamps: '0:00 Intro',
      socialLinks: 'https://x.com/example',
      hashtags: '#a,#b',
    });

    expect(result).toBeNull();
  });
});

describe('buildGeometricDirectInputExtractionInfo', () => {
  it('builds extraction info with canonical fields', () => {
    const result = buildGeometricDirectInputExtractionInfo({
      baseQuery: 'protein supplements',
      language: 'it',
      country: 'google.it',
      brandName: '',
    });

    expect(result).not.toBeNull();
    expect(result?.extractionPayload).toEqual({
      baseQuery: 'protein supplements',
      language: 'it',
      country: 'google.it',
    });
    expect(result?.briefingText).toContain('Base query: protein supplements');
    expect(result?.briefingText).toContain('Language: it');
    expect(result?.briefingText).toContain('Country: google.it');
    expect(result?.extractionArtifactId).toBe('direct-input:geometric');
    expect(result?.briefingId).toBe('direct-input:geometric');
  });

  it('returns null when any required field is missing', () => {
    expect(buildGeometricDirectInputExtractionInfo({ baseQuery: '', language: 'it', country: 'google.it', brandName: '' })).toBeNull();
    expect(buildGeometricDirectInputExtractionInfo({ baseQuery: 'query', language: '', country: 'google.it', brandName: '' })).toBeNull();
    expect(buildGeometricDirectInputExtractionInfo({ baseQuery: 'query', language: 'it', country: '', brandName: '' })).toBeNull();
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
        titolo: '',
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
      selectedAssetIds: [],
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
        titolo: '',
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
      selectedAssetIds: [],
    });

    expect(request.input.extractionPayload).toMatchObject({
      campaign_objective: 'Sales',
    });
  });
});