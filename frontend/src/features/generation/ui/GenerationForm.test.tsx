import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { appCopy } from '../../../app/copy/system';
import { GenerationForm } from './GenerationForm';
import type { GenerationRequest } from '../contracts/backend-stream';

const uploadBriefMock = vi.fn();
const runExtractionMock = vi.fn();

vi.mock('../../tools/runtime/tools-client', () => ({
  uploadBrief: (...args: unknown[]) => uploadBriefMock(...args),
  runExtraction: (...args: unknown[]) => runExtractionMock(...args),
}));

describe('GenerationForm', () => {
  it('processes briefing with real upload/extraction client flow', async () => {
    uploadBriefMock.mockResolvedValue({
      briefingId: 'briefing-frontend-001',
      projectId: 'project-001',
      toolKey: 'funnel-pages',
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      size: 128,
      parsedFormat: 'md',
      normalizedText: 'Contenuto brief',
      charCount: 14,
      wordCount: 2,
    });
    runExtractionMock.mockResolvedValue({
      artifactId: 'artifact-extraction-001',
      content: '{"schemaVersion":"extraction.v1"}',
      payload: { schemaVersion: 'extraction.v1' },
    });

    const setupStates: Array<{ phase: string; extractionLifecycle: string }> = [];
    const onStart = vi.fn<(request: GenerationRequest) => void>();
    const onExtractionContextChange = vi.fn();

    render(
      <GenerationForm
        userId="user-001"
        toolsUploadEnabled
        projectOptions={[{ id: 'project-001', name: 'Project 001' }]}
        projectsLoading={false}
        projectsError={null}
        disabled={false}
        checkpoints={[]}
        prefillProjectId={null}
        getExtractionContext={() => null}
        onExtractionContextChange={onExtractionContextChange}
        onStart={onStart}
        onSetupStateChange={(state) => {
          setupStates.push({
            phase: state.phase,
            extractionLifecycle: state.extractionLifecycle,
          });
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Project ID/i), {
      target: { value: 'project-001' },
    });

    const fileInput = screen.getByLabelText(appCopy.ui.labels.briefingFile) as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['# brief'], 'brief.md', { type: 'text/markdown' })],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: appCopy.ui.actions.processBriefing }));

    await waitFor(() => {
      expect(uploadBriefMock).toHaveBeenCalledTimes(1);
      expect(runExtractionMock).toHaveBeenCalledTimes(1);
      expect(onExtractionContextChange).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(setupStates.some((state) => state.phase === 'review')).toBe(true);
      expect(setupStates.some((state) => state.extractionLifecycle === 'completed_full')).toBe(true);
    });

    expect(setupStates.some((state) => state.phase === 'uploading')).toBe(true);
    expect(setupStates.some((state) => state.extractionLifecycle === 'in_progress')).toBe(true);
    expect(setupStates.some((state) => state.phase === 'review')).toBe(true);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('disables briefing processing when toolsUpload capability is disabled', () => {
    render(
      <GenerationForm
        userId="user-001"
        toolsUploadEnabled={false}
        projectOptions={[{ id: 'project-001', name: 'Project 001' }]}
        projectsLoading={false}
        projectsError={null}
        disabled={false}
        checkpoints={[]}
        prefillProjectId={null}
        getExtractionContext={() => null}
        onExtractionContextChange={vi.fn()}
        onStart={vi.fn()}
        onSetupStateChange={vi.fn()}
      />,
    );

    const processButton = screen.getByRole('button', { name: appCopy.ui.actions.processBriefing });
    expect(processButton).toBeDisabled();
    expect(screen.getByText(appCopy.ui.states.toolsUploadDisabled)).toBeInTheDocument();
  });
});
