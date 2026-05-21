import { describe, expect, it, vi, beforeEach } from 'vitest';
import { orchestrateToolStep, runExtraction, uploadBrief } from './tools-client';
import { GenerationTransportError } from '../../generation/runtime/generation-client';

const streamGenerationMock = vi.fn();
const getArtifactByIdMock = vi.fn();

vi.mock('../../generation/runtime/generation-client', () => ({
  streamGeneration: (...args: unknown[]) => streamGenerationMock(...args),
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

  it('runExtraction consumes stream events and returns artifact payload', async () => {
    streamGenerationMock.mockImplementation(async (_request, options) => {
      options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
      options.onEvent({ event: 'chunk', data: { artifactId: 'artifact-001', chunk: '{"ok":', sequence: 1 } });
      options.onEvent({ event: 'chunk', data: { artifactId: 'artifact-001', chunk: 'true}', sequence: 2 } });
      options.onEvent({ event: 'terminal', data: { artifactId: 'artifact-001', status: 'completed', reason: null } });
    });

    const result = await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(streamGenerationMock).toHaveBeenCalledTimes(1);
    expect(result.artifactId).toBe('artifact-001');
    expect(result.content).toBe('{"ok":true}');
    expect(result.payload).toEqual({ ok: true });
  });

  it('runExtraction enforces fixed analitico tone for extraction jobs', async () => {
    streamGenerationMock.mockImplementation(async (_request, options) => {
      options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
      options.onEvent({
        event: 'chunk',
        data: {
          artifactId: 'artifact-001',
          chunk: '{"schemaVersion":"extraction.v1"}',
          sequence: 1,
        },
      });
      options.onEvent({ event: 'terminal', data: { artifactId: 'artifact-001', status: 'completed', reason: null } });
    });

    await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      tone: 'Casual',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(streamGenerationMock).toHaveBeenCalledTimes(1);
    const request = streamGenerationMock.mock.calls[0]?.[0] as {
      input?: { tone?: string };
    };
    expect(request.input?.tone).toBe('analitico');
  });

  it('runExtraction recovers payload from artifact detail when stream has no chunks', async () => {
    streamGenerationMock.mockImplementation(async (_request, options) => {
      options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
      options.onEvent({ event: 'terminal', data: { artifactId: 'artifact-001', status: 'completed', reason: null } });
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
    expect(result.content).toBe('{"fromDetail":true}');
    expect(result.payload).toEqual({ fromDetail: true });
    expect(getArtifactByIdMock).toHaveBeenCalledTimes(1);
  });

  it('runExtraction parses fenced json chunk output into extraction payload', async () => {
    streamGenerationMock.mockImplementation(async (_request, options) => {
      options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
      options.onEvent({
        event: 'chunk',
        data: {
          artifactId: 'artifact-001',
          chunk: '```json\n{"payload":{"offer":"test","audience":"cold"}}\n```',
          sequence: 1,
        },
      });
      options.onEvent({ event: 'terminal', data: { artifactId: 'artifact-001', status: 'completed', reason: null } });
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

  it('runExtraction rejects top-level array payloads as insufficient extraction context', async () => {
    streamGenerationMock.mockImplementation(async (_request, options) => {
      options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
      options.onEvent({
        event: 'chunk',
        data: {
          artifactId: 'artifact-001',
          chunk: '[{"offer":"test"}]',
          sequence: 1,
        },
      });
      options.onEvent({ event: 'terminal', data: { artifactId: 'artifact-001', status: 'completed', reason: null } });
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

  it('runExtraction recovers payload from artifact detail when streamed extraction content is markdown', async () => {
    streamGenerationMock.mockImplementation(async (_request, options) => {
      options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
      options.onEvent({
        event: 'chunk',
        data: {
          artifactId: 'artifact-001',
          chunk: '## Knowledge Content\n- Offer strategy\n\n## Avatar\n- Founder',
          sequence: 1,
        },
      });
      options.onEvent({ event: 'terminal', data: { artifactId: 'artifact-001', status: 'completed', reason: null } });
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
    streamGenerationMock.mockImplementation(async (_request, options) => {
      options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
      options.onEvent({ event: 'terminal', data: { artifactId: 'artifact-001', status: 'completed', reason: null } });
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

  describe('runExtraction — stream interruption recovery', () => {
    const makeTransportError = (code: 'transport_mid_stream' | 'terminal_failed', message: string) =>
      new GenerationTransportError(code, message, code === 'transport_mid_stream');

    it('recovers when stream drops mid-transport and artifact exists on server', async () => {
      streamGenerationMock.mockImplementation(async (_request, options) => {
        options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
        throw makeTransportError('transport_mid_stream', 'Connection closed before terminal event');
      });

      getArtifactByIdMock.mockResolvedValue({
        artifactId: 'artifact-001',
        content: '{"recovered":true}',
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
      expect(result.content).toBe('{"recovered":true}');
      expect(result.payload).toEqual({ recovered: true });
      expect(getArtifactByIdMock).toHaveBeenCalledTimes(1);
    });

    it('throws original error when stream drops mid-transport but artifact not found', async () => {
      streamGenerationMock.mockImplementation(async (_request, options) => {
        options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
        throw makeTransportError('transport_mid_stream', 'Connection closed before terminal event');
      });

      getArtifactByIdMock.mockResolvedValue(null);

      await expect(runExtraction({
        userId: 'user-001',
        projectId: 'project-001',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        briefingId: 'brief-001',
        briefingText: 'brief text',
      })).rejects.toThrow('Connection closed before terminal event');

      expect(getArtifactByIdMock).toHaveBeenCalledTimes(1);
    });

    it('throws original error when stream drops before start event (no artifact ID)', async () => {
      streamGenerationMock.mockRejectedValue(
        makeTransportError('transport_mid_stream', 'Connection closed before terminal event'),
      );      await expect(runExtraction({
        userId: 'user-001',
        projectId: 'project-001',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        briefingId: 'brief-001',
        briefingText: 'brief text',
      })).rejects.toThrow('Connection closed before terminal event');

      // No recovery attempt without a known artifact ID
      expect(getArtifactByIdMock).not.toHaveBeenCalled();
    });

    it('does not attempt recovery on terminal_failed (server explicitly failed)', async () => {
      streamGenerationMock.mockImplementation(async (_request, options) => {
        options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
        throw makeTransportError('terminal_failed', 'Extraction failed on server');
      });

      await expect(runExtraction({
        userId: 'user-001',
        projectId: 'project-001',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        briefingId: 'brief-001',
        briefingText: 'brief text',
      })).rejects.toThrow('Extraction failed on server');

      expect(getArtifactByIdMock).not.toHaveBeenCalled();
    });

    it('throws original error when recovery fetch itself fails', async () => {
      streamGenerationMock.mockImplementation(async (_request, options) => {
        options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
        throw makeTransportError('transport_mid_stream', 'Connection closed before terminal event');
      });

      getArtifactByIdMock.mockRejectedValue(new Error('Network error during recovery'));

      await expect(runExtraction({
        userId: 'user-001',
        projectId: 'project-001',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        briefingId: 'brief-001',
        briefingText: 'brief text',
      })).rejects.toThrow('Connection closed before terminal event');
    });
  });
});

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

  it('runExtraction consumes stream events and returns artifact payload', async () => {
    streamGenerationMock.mockImplementation(async (_request, options) => {
      options.onEvent({ event: 'start', data: { requestId: 'req-001', artifactId: 'artifact-001' } });
      options.onEvent({ event: 'chunk', data: { artifactId: 'artifact-001', chunk: '{"ok":', sequence: 1 } });
      options.onEvent({ event: 'chunk', data: { artifactId: 'artifact-001', chunk: 'true}', sequence: 2 } });
      options.onEvent({ event: 'terminal', data: { artifactId: 'artifact-001', status: 'completed', reason: null } });
    });

    const result = await runExtraction({
      userId: 'user-001',
      projectId: 'project-001',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(streamGenerationMock).toHaveBeenCalledTimes(1);
    expect(result.artifactId).toBe('artifact-001');
    expect(result.content).toBe('{"ok":true}');
    expect(result.payload).toEqual({ ok: true });
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
