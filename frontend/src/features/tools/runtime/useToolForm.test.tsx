import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBriefingUpload } from './useToolForm';
import { listArtifacts } from '../../artifacts/runtime/artifacts-client';
import { runExtraction, uploadBrief } from './tools-client';
import type { ExtractionContext } from '../../generation/runtime/GenerationWorkspaceProvider';

let storedExtractionContext: ExtractionContext | null = null;
const upsertExtractionContextMock = vi.fn((context: ExtractionContext) => {
  storedExtractionContext = context;
});

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'user-1' } },
    capabilities: { artifacts: true, toolsUpload: true },
    apiBaseUrl: '',
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({
    artifacts: [],
    getExtractionContext: (projectId: string) => (
      storedExtractionContext?.projectId === projectId ? storedExtractionContext : null
    ),
    upsertExtractionContext: upsertExtractionContextMock,
  }),
}));

vi.mock('../../artifacts/runtime/artifacts-client', () => ({
  listArtifacts: vi.fn(),
}));

vi.mock('./tools-client', () => ({
  uploadBrief: vi.fn(),
  runExtraction: vi.fn(),
}));

const mockedListArtifacts = vi.mocked(listArtifacts);
const mockedUploadBrief = vi.mocked(uploadBrief);
const mockedRunExtraction = vi.mocked(runExtraction);

const Probe = () => {
  const briefing = useBriefingUpload('funnel-pages', 'project-1');

  return (
    <div>
      <input
        data-testid="brief-file"
        type="file"
        onChange={(event) => {
          void briefing.handleFileSelected(event.target.files?.[0] ?? null);
        }}
      />
      <span data-testid="status">{briefing.status}</span>
      <span data-testid="artifact-id">{briefing.extractionContext?.extractionArtifactId ?? ''}</span>
    </div>
  );
};

describe('useBriefingUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedExtractionContext = null;
  });

  it('recovers extraction from persisted artifact and exposes ready status', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-1',
      projectId: 'project-1',
      toolKey: 'funnel-pages',
      fileName: 'brief.txt',
      mimeType: 'text/plain',
      size: 10,
      parsedFormat: 'txt',
      normalizedText: 'brief text',
      charCount: 10,
      wordCount: 2,
    });
    mockedRunExtraction.mockImplementation(() => new Promise(() => undefined));
    mockedListArtifacts.mockResolvedValue([
      {
        artifactId: 'artifact-extract-1',
        requestId: 'req-extract-1',
        projectId: 'project-1',
        artifactType: 'extraction',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'extraction',
        workflowType: 'extraction',
        content: '{"summary":"ok"}',
        createdAt: '2026-05-02T10:00:00.000Z',
        updatedAt: '2026-05-02T10:00:01.000Z',
        sourceRequest: {
          requestId: 'req-extract-1',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'extraction',
          model: 'openrouter/auto',
          toolKey: 'extraction',
          workflowType: 'extraction',
          input: {
            briefingId: 'brief-1',
            toolKey: 'funnel-pages',
          },
        },
      },
    ]);

    render(<Probe />);

    fireEvent.change(screen.getByTestId('brief-file'), {
      target: {
        files: [new File(['brief'], 'brief.txt', { type: 'text/plain' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ready');
    });

    expect(screen.getByTestId('artifact-id').textContent).toBe('artifact-extract-1');
    expect(upsertExtractionContextMock).toHaveBeenCalledWith(expect.objectContaining({
      extractionArtifactId: 'artifact-extract-1',
      briefingId: 'brief-1',
      parsedFormat: 'txt',
    }));
  });
});