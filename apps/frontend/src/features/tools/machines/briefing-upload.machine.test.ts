import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor, waitFor } from 'xstate';
import { briefingUploadMachine } from './briefing-upload.machine';
import { runExtraction, uploadBrief } from '../runtime/tools-client';

vi.mock('../runtime/tools-client', () => ({
  uploadBrief: vi.fn(),
  runExtraction: vi.fn(),
}));

const mockedUploadBrief = vi.mocked(uploadBrief);
const mockedRunExtraction = vi.mocked(runExtraction);

const createMachineActor = () => {
  const actor = createActor(briefingUploadMachine, {
    input: {
      toolKey: 'funnel-pages',
      projectId: 'project-1',
      apiBaseUrl: '',
      capabilities: { toolsUpload: true },
      userId: 'user-1',
    },
  });

  actor.start();
  return actor;
};

describe('briefingUploadMachine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions idle -> uploading -> extracting -> ready', async () => {
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
    mockedRunExtraction.mockResolvedValue({
      artifactId: 'artifact-1',
      content: '{"ok":true}',
      payload: { ok: true },
    });

    const actor = createMachineActor();
    const states: string[] = [];
    actor.subscribe((snapshot) => {
      states.push(String(snapshot.value));
    });

    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.txt', { type: 'text/plain' }) });

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));

    expect(states).toContain('uploading');
    expect(states).toContain('extracting');
    expect(actor.getSnapshot().value).toBe('ready');
    expect(actor.getSnapshot().context.briefingId).toBe('brief-1');
    expect(actor.getSnapshot().context.extractionArtifactId).toBe('artifact-1');
  });

  it('returns to idle with error when upload fails', async () => {
    mockedUploadBrief.mockRejectedValue(new Error('upload failed'));

    const actor = createMachineActor();
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.md', { type: 'text/markdown' }) });

    await waitFor(actor, (snapshot) => snapshot.matches('idle') && snapshot.context.error === 'upload failed');

    expect(mockedRunExtraction).not.toHaveBeenCalled();
    expect(actor.getSnapshot().context.error).toBe('upload failed');
  });

  it('returns to idle with error when extraction fails', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-2',
      projectId: 'project-1',
      toolKey: 'funnel-pages',
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      size: 10,
      parsedFormat: 'md',
      normalizedText: 'brief text',
      charCount: 10,
      wordCount: 2,
    });
    mockedRunExtraction.mockRejectedValue(new Error('extraction failed'));

    const actor = createMachineActor();
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.md', { type: 'text/markdown' }) });

    await waitFor(actor, (snapshot) => snapshot.matches('idle') && snapshot.context.error === 'extraction failed');

    expect(actor.getSnapshot().context.error).toBe('extraction failed');
  });

  it('returns to idle when extraction output is semantically insufficient', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-2',
      projectId: 'project-1',
      toolKey: 'funnel-pages',
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      size: 10,
      parsedFormat: 'md',
      normalizedText: 'brief text',
      charCount: 10,
      wordCount: 2,
    });
    mockedRunExtraction.mockResolvedValue({
      artifactId: 'artifact-empty',
      content: '{}',
      payload: {},
    });

    const actor = createMachineActor();
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.md', { type: 'text/markdown' }) });

    await waitFor(actor, (snapshot) => snapshot.matches('idle'));

    const context = actor.getSnapshot().context;
    expect(context.error).toBe('extraction_context_insufficient');
    expect(context.extractionArtifactId).toBeNull();
    expect(context.extractionPayload).toBeNull();
    expect(context.briefingId).toBeNull();
  });

  it('transitions extracting -> ready when extraction is recovered from persisted artifact', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-recovered',
      projectId: 'project-1',
      toolKey: 'funnel-pages',
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      size: 10,
      parsedFormat: 'md',
      normalizedText: 'brief text',
      charCount: 10,
      wordCount: 2,
    });

    mockedRunExtraction.mockImplementation(() => new Promise(() => undefined));

    const actor = createMachineActor();
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.md', { type: 'text/markdown' }) });

    await waitFor(actor, (snapshot) => snapshot.matches('extracting'));

    actor.send({
      type: 'EXTRACTION_RECOVERED',
      artifactId: 'artifact-recovered',
      payload: { recovered: true },
      normalizedText: 'recovered brief',
      parsedFormat: 'md',
    });

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));

    expect(actor.getSnapshot().context.extractionArtifactId).toBe('artifact-recovered');
    expect(actor.getSnapshot().context.extractionPayload).toEqual({ recovered: true });
    expect(actor.getSnapshot().context.normalizedText).toBe('recovered brief');
    expect(actor.getSnapshot().context.parsedFormat).toBe('md');
    actor.stop();
  });

  it('uses synced projectId after initial empty input', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-synced',
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
    mockedRunExtraction.mockResolvedValue({
      artifactId: 'artifact-synced',
      content: '{"ok":true}',
      payload: { ok: true },
    });

    const actor = createActor(briefingUploadMachine, {
      input: {
        toolKey: 'funnel-pages',
        projectId: '',
        apiBaseUrl: '',
        capabilities: { toolsUpload: true },
        userId: 'user-1',
      },
    });
    actor.start();

    actor.send({
      type: 'INPUT_SYNCED',
      projectId: 'project-1',
      apiBaseUrl: '',
      capabilities: { toolsUpload: true },
      userId: 'user-1',
    });
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.txt', { type: 'text/plain' }) });

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));

    expect(mockedUploadBrief).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1' }),
      expect.any(Object),
    );
    actor.stop();
  });

  it('rejects unsupported extension via guard and stays idle', async () => {
    const actor = createMachineActor();
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.pdf', { type: 'application/pdf' }) });

    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches('idle')
        && snapshot.context.error === 'Formato non supportato. Usa .docx, .txt o .md',
    );

    expect(mockedUploadBrief).not.toHaveBeenCalled();
    expect(actor.getSnapshot().context.file).toBeNull();
  });

  it('resets from ready to idle', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-3',
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
    mockedRunExtraction.mockResolvedValue({
      artifactId: 'artifact-3',
      content: '{"ok":true}',
      payload: { ok: true },
    });

    const actor = createMachineActor();
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.txt', { type: 'text/plain' }) });

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));
    actor.send({ type: 'RESET' });

    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.file).toBeNull();
    expect(actor.getSnapshot().context.extractionArtifactId).toBeNull();
  });

    it('rejects file when projectId is empty and stays idle with project error', async () => {
      const actor = createActor(briefingUploadMachine, {
        input: {
          toolKey: 'funnel-pages',
          projectId: '',
          apiBaseUrl: '',
          capabilities: { toolsUpload: true },
          userId: 'user-1',
        },
      });
      actor.start();

      actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.txt', { type: 'text/plain' }) });

      await waitFor(
        actor,
        (snapshot) =>
          snapshot.matches('idle')
          && snapshot.context.error === 'Seleziona prima un progetto',
      );

      expect(mockedUploadBrief).not.toHaveBeenCalled();
      expect(actor.getSnapshot().context.file).toBeNull();
      actor.stop();
    });

    it('returns to idle with session error when userId is null at upload completion', async () => {
      mockedUploadBrief.mockResolvedValue({
        briefingId: 'brief-session',
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

      const actor = createActor(briefingUploadMachine, {
        input: {
          toolKey: 'funnel-pages',
          projectId: 'project-1',
          apiBaseUrl: '',
          capabilities: { toolsUpload: true },
          userId: null,
        },
      });
      actor.start();

      actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.txt', { type: 'text/plain' }) });

      await waitFor(
        actor,
        (snapshot) =>
          snapshot.matches('idle')
          && snapshot.context.error === 'Sessione non disponibile. Ricarica la pagina.',
      );

      expect(mockedRunExtraction).not.toHaveBeenCalled();
      actor.stop();
    });

    // TASK-018: EXTRACTION_RECOVERED idempotency
    it('EXTRACTION_RECOVERED in idle: transitions to ready with briefingId and fileName from event', async () => {
      const actor = createMachineActor();

      actor.send({
        type: 'EXTRACTION_RECOVERED',
        artifactId: 'artifact-recovered-idle',
        payload: { topic: 'test' },
        briefingId: 'brief-from-event',
        fileName: 'recovered-brief.md',
        normalizedText: 'recovered idle brief',
        parsedFormat: 'md',
      });

      await waitFor(actor, (snapshot) => snapshot.matches('ready'));

      const ctx = actor.getSnapshot().context;
      expect(ctx.extractionArtifactId).toBe('artifact-recovered-idle');
      expect(ctx.extractionPayload).toEqual({ topic: 'test' });
      expect(ctx.briefingId).toBe('brief-from-event');
      expect(ctx.fileName).toBe('recovered-brief.md');
      expect(ctx.normalizedText).toBe('recovered idle brief');
      expect(ctx.parsedFormat).toBe('md');
      expect(ctx.error).toBeNull();
      actor.stop();
    });

    it('EXTRACTION_RECOVERED in ready: idempotent — nessun crash, stato rimane ready, context invariato', async () => {
      mockedUploadBrief.mockResolvedValue({
        briefingId: 'brief-ready',
        projectId: 'project-1',
        toolKey: 'funnel-pages',
        fileName: 'brief.md',
        mimeType: 'text/markdown',
        size: 10,
        parsedFormat: 'md',
        normalizedText: 'brief text',
        charCount: 10,
        wordCount: 2,
      });
      mockedRunExtraction.mockResolvedValue({
        artifactId: 'artifact-ready',
        content: '{"ok":true}',
        payload: { ok: true },
      });

      const actor = createMachineActor();
      actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.md', { type: 'text/markdown' }) });

      await waitFor(actor, (snapshot) => snapshot.matches('ready'));
      expect(actor.getSnapshot().context.extractionArtifactId).toBe('artifact-ready');

      // EXTRACTION_RECOVERED in ready: nessun handler → droppato silenziosamente (idempotenza)
      actor.send({
        type: 'EXTRACTION_RECOVERED',
        artifactId: 'artifact-duplicate',
        payload: { duplicate: true },
      });

      // Stato e context invariati
      expect(actor.getSnapshot().value).toBe('ready');
      expect(actor.getSnapshot().context.extractionArtifactId).toBe('artifact-ready');
      expect(actor.getSnapshot().context.error).toBeNull();
      actor.stop();
    });
});
