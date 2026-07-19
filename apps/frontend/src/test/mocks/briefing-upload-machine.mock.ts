import { assign, setup } from 'xstate';
import { isExtractionContextValidForTool } from '../../features/tools/machines/extraction-context-validity';

type BriefingMockConfig = {
  initialState?: 'idle' | 'ready';
  contextOverrides?: Partial<{
    projectId: string;
    toolKey: string;
    apiBaseUrl: string;
    capabilities: Record<string, unknown>;
    userId: string;
    file: File | null;
    fileName: string | null;
    angleDetectorFile: File | null;
    angleDetectorFileName: string | null;
    briefingId: string | null;
    extractionArtifactId: string | null;
    extractionPayload: Record<string, unknown> | null;
    normalizedText: string | null;
    parsedFormat: 'txt' | 'md' | 'docx' | null;
    angleDetectorNormalizedText: string | null;
    angleDetectorParsedFormat: 'txt' | 'md' | 'docx' | null;
    error: string | null;
  }>;
};

const DEFAULT_CONTEXT = {
  projectId: 'project-001',
  toolKey: 'funnel-pages',
  apiBaseUrl: '',
  capabilities: {} as Record<string, unknown>,
  userId: 'seed-user-001',
  file: null as File | null,
  fileName: null as string | null,
  angleDetectorFile: null as File | null,
  angleDetectorFileName: null as string | null,
  briefingId: 'brief-001' as string | null,
  extractionArtifactId: 'artifact-extract-001' as string | null,
  extractionPayload: { schemaVersion: 'extraction.v1' } as Record<string, unknown> | null,
  normalizedText: 'brief text' as string | null,
  parsedFormat: 'md' as 'txt' | 'md' | 'docx' | null,
  angleDetectorNormalizedText: null as string | null,
  angleDetectorParsedFormat: null as 'txt' | 'md' | 'docx' | null,
  error: null as string | null,
};

export const createBriefingUploadMachineMock = (config?: BriefingMockConfig) => {
  const context = { ...DEFAULT_CONTEXT, ...config?.contextOverrides };
  const initialState = config?.initialState ?? 'ready';

  const briefingUploadMachine = setup({
    types: {
      context: {} as typeof DEFAULT_CONTEXT,
      events: {} as
        | { type: 'FILE_SELECTED'; file: File; sourceKey?: string }
        | { type: 'RESET' }
        | { type: 'INPUT_SYNCED'; projectId: string; apiBaseUrl: string; capabilities: Record<string, unknown>; userId: string | null }
        | {
            type: 'EXTRACTION_RECOVERED';
            artifactId: string;
            payload: Record<string, unknown>;
            briefingId?: string | null;
            fileName?: string | null;
            normalizedText?: string | null;
            parsedFormat?: 'txt' | 'md' | 'docx' | null;
          },
      input: {} as {
        toolKey: string;
        projectId: string;
        apiBaseUrl: string;
        capabilities: Record<string, unknown>;
        userId: string;
      },
    },
  }).createMachine({
    id: 'briefingUploadMachine',
    context: () => ({ ...context }),
    initial: initialState,
    states: {
      idle: {
        on: {
          FILE_SELECTED: {
            target: 'ready',
            actions: assign({
              extractionArtifactId: () => 'mock-extraction-artifact',
              extractionPayload: () => ({ topic: 'mock' }),
              briefingId: () => 'mock-briefing-id',
              fileName: ({ event }) => event.file.name,
              normalizedText: () => 'mock brief text',
              parsedFormat: () => 'md',
            }),
          },
          RESET: {
            target: 'idle',
            actions: assign({
              extractionArtifactId: () => null,
              extractionPayload: () => null,
              briefingId: () => null,
              fileName: () => null,
              normalizedText: () => null,
              parsedFormat: () => null,
            }),
          },
          INPUT_SYNCED: { target: 'idle' },
          EXTRACTION_RECOVERED: {
            target: 'ready',
            actions: assign({
              extractionArtifactId: ({ event }) => event.artifactId,
              extractionPayload: ({ event }) => event.payload,
              briefingId: ({ event }) => event.briefingId ?? null,
              fileName: ({ event }) => event.fileName ?? null,
              normalizedText: ({ event }) => event.normalizedText ?? null,
              parsedFormat: ({ event }) => event.parsedFormat ?? null,
            }),
          },
        },
      },
      ready: {
        on: {
          RESET: {
            target: 'idle',
            actions: assign({
              extractionArtifactId: () => null,
              extractionPayload: () => null,
              briefingId: () => null,
              fileName: () => null,
              normalizedText: () => null,
              parsedFormat: () => null,
            }),
          },
          INPUT_SYNCED: { target: 'ready' },
          EXTRACTION_RECOVERED: {
            target: 'ready',
            actions: assign({
              extractionArtifactId: ({ context: ctx }) => ctx.extractionArtifactId,
              extractionPayload: ({ context: ctx }) => ctx.extractionPayload,
              briefingId: ({ context: ctx }) => ctx.briefingId,
              fileName: ({ context: ctx }) => ctx.fileName,
              normalizedText: ({ context: ctx }) => ctx.normalizedText,
              parsedFormat: ({ context: ctx }) => ctx.parsedFormat,
            }),
          },
        },
      },
    },
  });

  const hasReadyBriefingExtractionContext = (
    toolKey: string,
    briefingActorRef: { getSnapshot?: () => { matches: (value: string) => boolean; context: {
      extractionArtifactId: string | null;
      extractionPayload: Record<string, unknown> | null;
      briefingId: string | null;
      normalizedText: string | null;
    } } } | null,
  ) => {
    const snapshot = briefingActorRef?.getSnapshot?.();
    return snapshot?.matches('ready')
      && (snapshot.context.extractionArtifactId?.trim().length ?? 0) > 0
      && (snapshot.context.briefingId?.trim().length ?? 0) > 0
      && isExtractionContextValidForTool(
        toolKey as Parameters<typeof isExtractionContextValidForTool>[0],
        snapshot.context.extractionPayload,
        snapshot.context.normalizedText,
      );
  };

  return { briefingUploadMachine, hasReadyBriefingExtractionContext };
};
