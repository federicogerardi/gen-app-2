import { describe, expect, it, vi, beforeEach } from 'vitest';
import { orchestrateToolStep, runExtraction, uploadBrief } from './tools-client';
import { GenerationTransportError } from '../../generation/runtime/generation-client';

const runGenerationMock = vi.fn();
const getArtifactByIdMock = vi.fn();

vi.mock('../../generation/runtime/generation-client', () => ({
  runGeneration: (...args: unknown[]) => runGenerationMock(...args),
  GenerationTransportError: class GenerationTransportError extends Error {
    code: string;
    retryable: boolean;

    constructor(code: string, message: string, retryable: boolean) {
      super(message);
      this.code = code;
      this.retryable = retryable;
      this.name = 'GenerationTransportError';
    }
  },
}));

vi.mock('../../artifacts/runtime/artifacts-client', () => ({
  getArtifactById: (...args: unknown[]) => getArtifactByIdMock(...args),
}));

describe('tools-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploadBrief throws when tools capability is disabled', async () => {
    await expect(uploadBrief(
      {
        projectId: 'project-001',
        toolKey: 'funnel-pages',
        file: new File(['brief'], 'brief.md', { type: 'text/markdown' }),
      },
      {
        capabilities: { toolsUpload: false },
      },
    )).rejects.toThrow(/capability is disabled/i);
  });

  it('uploadBrief posts payload and returns briefing metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          briefing: {
            briefingId: 'brief-001',
            projectId: 'project-001',
            toolKey: 'funnel-pages',
            fileName: 'brief.md',
            mimeType: 'text/markdown',
            size: 42,
            parsedFormat: 'md',
            normalizedText: 'brief text',
            charCount: 10,
            wordCount: 2,
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await uploadBrief(
      {
        projectId: 'project-001',
        toolKey: 'funnel-pages',
        file: new File(['brief text'], 'brief.md', { type: 'text/markdown' }),
      },
      {
        capabilities: { toolsUpload: true },
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.briefingId).toBe('brief-001');
    expect(result.parsedFormat).toBe('md');
  });

  it('runExtraction calls runGeneration and returns artifact payload', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: '{"ok":true}',
      status: 'completed',
    });

    const result = await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(runGenerationMock).toHaveBeenCalledTimes(1);
    expect(result.artifactId).toBe('artifact-001');
    expect(result.content).toBe('{"ok":true}');
    expect(result.payload).toEqual({ ok: true });
  });

  it('runExtraction sends extraction request for extraction jobs', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: '{"schemaVersion":"extraction.v1"}',
      status: 'completed',
    });

    await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(runGenerationMock).toHaveBeenCalledTimes(1);
  });

  it('runExtraction recovers payload from artifact detail when content has empty payload', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: 'plain text without json',
      status: 'completed',
    });

    getArtifactByIdMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: '{"fromDetail":true}',
      status: 'completed',
    });

    const result = await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(result.artifactId).toBe('artifact-001');
    expect(result.content).toBe('plain text without json');
    expect(result.payload).toEqual({ fromDetail: true });
    expect(getArtifactByIdMock).toHaveBeenCalledTimes(1);
  });

  it('runExtraction parses fenced json chunk output into extraction payload', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: '```json\n{"payload":{"offer":"test","audience":"cold"}}\n```',
      status: 'completed',
    });

    const result = await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(result.payload).toEqual({ offer: 'test', audience: 'cold' });
  });

  it('runExtraction normalizes known legacy aliases to canonical extraction keys', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: JSON.stringify({
        'Obiettivo del funnel': 'Lead generation',
        Target: 'Founder',
        Offerta: 'Audit',
        'Proof o testimonianze': 'Case study',
        'CTA principale': 'Prenota call',
      }),
      status: 'completed',
    });

    const result = await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(result.payload).toEqual({
      funnel_goal: 'Lead generation',
      target_audience: 'Founder',
      offer: 'Audit',
      proof: 'Case study',
      primary_cta: 'Prenota call',
    });
  });

  it('runExtraction rejects top-level array payloads as insufficient extraction context', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: '[{"offer":"test"}]',
      status: 'completed',
    });

    getArtifactByIdMock.mockResolvedValue(null);

    await expect(runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    })).rejects.toThrow('extraction_context_insufficient');

    expect(getArtifactByIdMock).toHaveBeenCalledTimes(1);
  });

  it('runExtraction recovers payload from artifact detail when extraction content is markdown', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: '## Knowledge Content\n- Offer strategy\n\n## Avatar\n- Founder',
      status: 'completed',
    });

    getArtifactByIdMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: 'markdown extraction output',
      sourceRequest: {
        input: {
          extraction: {
            payload: {
              knowledge_content: 'Offer strategy',
              avatar: 'Founder',
              pain_point: 'No predictable growth',
              offer: 'Consulting',
              proof: '20 case studies',
            },
          },
        },
      },
    });

    const result = await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'youtube-lf-script',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(result.artifactId).toBe('artifact-001');
    expect(result.payload).toEqual({
      knowledge_content: 'Offer strategy',
      avatar: 'Founder',
      pain_point: 'No predictable growth',
      offer: 'Consulting',
      proof: '20 case studies',
    });
    expect(getArtifactByIdMock).toHaveBeenCalledTimes(1);
  });

  it('runExtraction falls back to sourceRequest.input.extractionPayload when artifact content is non-json', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: 'extraction completed',
      status: 'completed',
    });

    getArtifactByIdMock.mockResolvedValue({
      artifactId: 'artifact-001',
      content: 'extraction completed',
      sourceRequest: {
        input: {
          extractionPayload: {
            audience: 'warm',
            tone: 'direct',
          },
        },
      },
    });

    const result = await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(result.payload).toEqual({ audience: 'warm', tone: 'direct' });
  });

  it('runExtraction throws on terminal_failed error', async () => {
    runGenerationMock.mockRejectedValue(
      new GenerationTransportError('terminal_failed', 'Extraction failed on server', false),
    );

    await expect(runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    })).rejects.toThrow('Extraction failed on server');
  });

  it('runExtraction includes knowledgeSources extraction payload for angle-generator', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-angle-001',
      content: '{"ok":true}',
      status: 'completed',
    });

    await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'angle-generator',
      briefingId: 'brief-001',
      briefingText: 'merged context',
      extractionPayload: {
        knowledgeSources: [
          { kind: 'briefing', fileName: 'briefing.md', parsedFormat: 'md' },
          { kind: 'angle-detector', fileName: 'angle-detector.md', parsedFormat: 'md' },
        ],
      },
    });

    expect(runGenerationMock).toHaveBeenCalledTimes(1);
    const request = runGenerationMock.mock.calls[0]?.[0] as {
      input: { extractionPayload?: { knowledgeSources?: unknown[] } };
      toolKey: string;
      workflowType: string;
    };
    expect(request.toolKey).toBe('extraction');
    expect(request.workflowType).toBe('extraction');
    expect(Array.isArray(request.input.extractionPayload?.knowledgeSources)).toBe(true);
    expect(request.input.extractionPayload?.knowledgeSources).toHaveLength(2);
  });

  it('runExtraction keeps single dispatch for angle-generator extraction request', async () => {
    runGenerationMock.mockResolvedValue({
      artifactId: 'artifact-angle-002',
      content: '{"ok":true}',
      status: 'completed',
    });

    await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'angle-generator',
      briefingId: 'brief-001',
      briefingText: 'merged context',
      extractionPayload: {
        knowledgeSources: [
          { kind: 'briefing', fileName: 'briefing.md', parsedFormat: 'md' },
          { kind: 'angle-detector', fileName: 'angle-detector.md', parsedFormat: 'md' },
        ],
      },
    });

    expect(runGenerationMock).toHaveBeenCalledTimes(1);
  });
});

describe('orchestrateToolStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns OrchestrationResult on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          orchestration: {
            toolKey: 'funnel-pages',
            targetStep: 'optin',
            stepDependencyArtifactIds: [],
            dependencyArtifactIdsByStep: {},
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await orchestrateToolStep('project-1', 'funnel-pages', 'optin', {
      capabilities: { artifacts: true },
    });

    expect(result.toolKey).toBe('funnel-pages');
    expect(result.targetStep).toBe('optin');
    expect(result.stepDependencyArtifactIds).toEqual([]);
    expect(result.dependencyArtifactIdsByStep).toEqual({});
  });

  it('returns OrchestrationResult with dependency artifacts when previous steps are completed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          orchestration: {
            toolKey: 'funnel-pages',
            targetStep: 'quiz',
            stepDependencyArtifactIds: ['art-optin-1'],
            dependencyArtifactIdsByStep: { optin: 'art-optin-1' },
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await orchestrateToolStep('project-1', 'funnel-pages', 'quiz', {
      capabilities: { artifacts: true },
    });

    expect(result.targetStep).toBe('quiz');
    expect(result.stepDependencyArtifactIds).toEqual(['art-optin-1']);
    expect(result.dependencyArtifactIdsByStep).toEqual({ optin: 'art-optin-1' });
  });

  it('throws when artifacts capability is disabled', async () => {
    await expect(
      orchestrateToolStep('project-1', 'funnel-pages', 'optin', {
        capabilities: { artifacts: false },
      }),
    ).rejects.toThrow(/capability is disabled/i);
  });
});
