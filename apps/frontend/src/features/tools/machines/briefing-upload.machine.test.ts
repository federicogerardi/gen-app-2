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

const requestExtraction = (actor: ReturnType<typeof createMachineActor> | ReturnType<typeof createAngleMachineActor>) => {
  actor.send({ type: 'EXTRACTION_REQUESTED' });
};

const createMachineActor = () => {
  const actor = createActor(briefingUploadMachine, {
    input: {
      toolKey: 'funnel-pages',
      projectId: 'project-1',
      model: 'openrouter/auto',
      campaignObjective: '',
      apiBaseUrl: '',
      capabilities: { toolsUpload: true },
      userId: 'user-1',
    },
  });

  actor.start();
  return actor;
};

const createAngleMachineActor = () => {
  const actor = createActor(briefingUploadMachine, {
    input: {
      toolKey: 'angle-generator',
      projectId: 'project-1',
      model: 'openrouter/auto',
      campaignObjective: '',
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

  it('transitions idle -> uploading -> extracting -> ready only after explicit extraction request', async () => {
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
    expect(actor.getSnapshot().matches('idle')).toBe(true);
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));

    expect(states).toContain('uploading');
    expect(states).toContain('extracting');
    expect(actor.getSnapshot().value).toBe('ready');
    expect(actor.getSnapshot().context.briefingId).toBe('brief-1');
    expect(actor.getSnapshot().context.extractionArtifactId).toBe('artifact-1');
  });

  it('returns to idle.failed when upload fails', async () => {
    mockedUploadBrief.mockRejectedValue(new Error('upload failed'));

    const actor = createMachineActor();
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.md', { type: 'text/markdown' }) });
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches({ idle: 'failed' }));

    expect(mockedRunExtraction).not.toHaveBeenCalled();
  });

  it('returns to idle.failed when extraction fails', async () => {
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
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches({ idle: 'failed' }));
  });

  it('keeps selected files in context when extraction fails so retry can continue', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-retry',
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
    mockedRunExtraction.mockRejectedValue(new Error('HTTP 400 while opening stream'));

    const actor = createMachineActor();
    const briefing = new File(['content'], 'brief.md', { type: 'text/markdown' });
    actor.send({ type: 'FILE_SELECTED', file: briefing });
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches({ idle: 'failed' }));

    expect(actor.getSnapshot().context.file).toBe(briefing);
    expect(actor.getSnapshot().context.fileName).toBe('brief.md');
  });

  it('returns to idle.failed when extraction output is semantically insufficient', async () => {
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
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches({ idle: 'failed' }));

    const context = actor.getSnapshot().context;
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
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches('extracting'));

    actor.send({
      type: 'EXTRACTION_RECOVERED',
      artifactId: 'artifact-recovered',
      payload: { ok: true },
      normalizedText: 'recovered brief',
      parsedFormat: 'md',
    });

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));

    expect(actor.getSnapshot().context.extractionArtifactId).toBe('artifact-recovered');
    expect(actor.getSnapshot().context.extractionPayload).toEqual({ ok: true });
    expect(actor.getSnapshot().context.briefingId).toBe('brief-recovered');
    expect(actor.getSnapshot().context.fileName).toBe('brief.md');
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
        model: 'openrouter/auto',
        campaignObjective: '',
        apiBaseUrl: '',
        capabilities: { toolsUpload: true },
        userId: 'user-1',
      },
    });
    actor.start();

    actor.send({
      type: 'INPUT_SYNCED',
      projectId: 'project-1',
      model: 'openrouter/auto',
      campaignObjective: '',
      apiBaseUrl: '',
      capabilities: { toolsUpload: true },
      userId: 'user-1',
    });
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.txt', { type: 'text/plain' }) });
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));

    expect(mockedUploadBrief).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1' }),
      expect.any(Object),
    );
    actor.stop();
  });

  it('rejects unsupported extension on extraction request and stays idle.failed', async () => {
    const actor = createMachineActor();
    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.pdf', { type: 'application/pdf' }) });
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches({ idle: 'failed' }));

    expect(mockedUploadBrief).not.toHaveBeenCalled();
    expect(actor.getSnapshot().context.file).toBeNull();
  });

  it('allows angle-generator upload with only briefing when second file is optional', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-angle-optional',
      projectId: 'project-1',
      toolKey: 'angle-generator',
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      size: 20,
      parsedFormat: 'md',
      normalizedText: 'brief text',
      charCount: 20,
      wordCount: 4,
    });
    mockedRunExtraction.mockResolvedValue({
      artifactId: 'artifact-angle-optional',
      content: '{"ok":true}',
      payload: { ok: true },
    });

    const actor = createAngleMachineActor();
    const briefing = new File(['brief'], 'brief.md', { type: 'text/markdown' });

    actor.send({ type: 'FILE_SELECTED', file: briefing });
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));

    expect(mockedUploadBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        toolKey: 'angle-generator',
        file: briefing,
      }),
      expect.any(Object),
    );
    expect(actor.getSnapshot().context.file).toBe(briefing);
    expect(actor.getSnapshot().context.fileName).toBe('brief.md');
    expect(actor.getSnapshot().context.angleDetectorFile).toBeNull();
  });

  it('accepts briefing-first flow without waiting for angle-detector', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-angle-2',
      projectId: 'project-1',
      toolKey: 'angle-generator',
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      size: 20,
      parsedFormat: 'md',
      normalizedText: 'brief text',
      charCount: 20,
      wordCount: 4,
      angleDetector: {
        fileName: 'angle-detector.md',
        mimeType: 'text/markdown',
        size: 22,
        parsedFormat: 'md',
        normalizedText: 'angle detector text',
        charCount: 22,
        wordCount: 4,
      },
      knowledgeSourcesCount: 2,
    });
    mockedRunExtraction.mockResolvedValue({
      artifactId: 'artifact-angle-2',
      content: '{"ok":true}',
      payload: { ok: true },
    });

    const actor = createAngleMachineActor();
    const briefing = new File(['brief'], 'brief.md', { type: 'text/markdown' });

    actor.send({ type: 'FILE_SELECTED', file: briefing });
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));

    expect(mockedUploadBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        toolKey: 'angle-generator',
        file: briefing,
      }),
      expect.any(Object),
    );
  });

  it('uploads angle-generator when both files are selected', async () => {
    mockedUploadBrief.mockResolvedValue({
      briefingId: 'brief-angle-1',
      projectId: 'project-1',
      toolKey: 'angle-generator',
      fileName: 'brief.md',
      mimeType: 'text/markdown',
      size: 20,
      parsedFormat: 'md',
      normalizedText: 'brief text',
      charCount: 20,
      wordCount: 4,
      angleDetector: {
        fileName: 'angle-detector.md',
        mimeType: 'text/markdown',
        size: 22,
        parsedFormat: 'md',
        normalizedText: 'angle detector text',
        charCount: 22,
        wordCount: 4,
      },
      knowledgeSourcesCount: 2,
    });
    mockedRunExtraction.mockResolvedValue({
      artifactId: 'artifact-angle-1',
      content: '{"ok":true}',
      payload: { ok: true },
    });

    const actor = createAngleMachineActor();
    const briefing = new File(['brief'], 'brief.md', { type: 'text/markdown' });
    const angleDetector = new File(['angle'], 'angle-detector.md', { type: 'text/markdown' });

    actor.send({ type: 'FILE_SELECTED', file: angleDetector, sourceKey: 'angle-detector-file' });
    actor.send({ type: 'FILE_SELECTED', file: briefing });
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));

    expect(mockedUploadBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        toolKey: 'angle-generator',
        file: briefing,
        angleDetectorFile: angleDetector,
      }),
      expect.any(Object),
    );
    expect(actor.getSnapshot().context.angleDetectorFileName).toBe('angle-detector.md');
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
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches('ready'));
    actor.send({ type: 'RESET' });

    expect(actor.getSnapshot().matches('idle')).toBe(true);
    expect(actor.getSnapshot().context.file).toBeNull();
    expect(actor.getSnapshot().context.extractionArtifactId).toBeNull();
  });

  it('rejects extraction when projectId is empty and stays idle.failed', async () => {
    const actor = createActor(briefingUploadMachine, {
      input: {
        toolKey: 'funnel-pages',
        projectId: '',
        model: 'openrouter/auto',
        campaignObjective: '',
        apiBaseUrl: '',
        capabilities: { toolsUpload: true },
        userId: 'user-1',
      },
    });
    actor.start();

    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.txt', { type: 'text/plain' }) });
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches({ idle: 'failed' }));

    expect(mockedUploadBrief).not.toHaveBeenCalled();
    expect(actor.getSnapshot().context.file).toBeNull();
    actor.stop();
  });

  it('returns to idle.failed when userId is null at upload completion', async () => {
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
        model: 'openrouter/auto',
        campaignObjective: '',
        apiBaseUrl: '',
        capabilities: { toolsUpload: true },
        userId: null,
      },
    });
    actor.start();

    actor.send({ type: 'FILE_SELECTED', file: new File(['content'], 'brief.txt', { type: 'text/plain' }) });
    requestExtraction(actor);

    await waitFor(actor, (snapshot) => snapshot.matches({ idle: 'failed' }));

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
    requestExtraction(actor);

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
    actor.stop();
  });
});
