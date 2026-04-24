import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runExtraction, uploadBrief } from './tools-client';

const streamGenerationMock = vi.fn();

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
      model: 'openrouter:auto',
      toolKey: 'funnel-pages',
      prompt: 'extract',
      briefingId: 'brief-001',
      briefingText: 'brief text',
    });

    expect(streamGenerationMock).toHaveBeenCalledTimes(1);
    expect(result.artifactId).toBe('artifact-001');
    expect(result.content).toBe('{"ok":true}');
    expect(result.payload).toEqual({ ok: true });
  });
});
