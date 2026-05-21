import { assign, fromPromise, setup, type ActorRefFrom } from 'xstate';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { isAllowedBriefingExtension } from '../../../app/runtime/shared-utils';
import { runExtraction, uploadBrief } from '../runtime/tools-client';
import type { RunExtractionResult, UploadBriefResult } from '../runtime/tools-client';
import type { SupportedTool } from './tool-flow.machine';
import { isExtractionContextValidForTool } from './extraction-context-validity';

export type BriefingUploadContext = {
  projectId: string;
  toolKey: SupportedTool;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
  userId: string | null;
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
};

export const hasReadyBriefingExtractionContext = (
  toolKey: SupportedTool,
  briefingActorRef: ActorRefFrom<typeof briefingUploadMachine> | null,
): boolean => {
  const snapshot = briefingActorRef?.getSnapshot();
  if (!snapshot?.matches('ready')) {
    return false;
  }

  const hasCoreContext = (snapshot.context.extractionArtifactId?.trim().length ?? 0) > 0
    && (snapshot.context.briefingId?.trim().length ?? 0) > 0;
  if (!hasCoreContext) {
    return false;
  }

  return isExtractionContextValidForTool(
    toolKey,
    snapshot.context.extractionPayload,
    snapshot.context.normalizedText,
  );
};

type BriefingUploadInput = {
  projectId: string;
  toolKey: SupportedTool;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
  userId: string | null;
};

type BriefingUploadEvent =
  | { type: 'FILE_SELECTED'; file: File; source?: 'briefing' | 'angle-detector' }
  | {
      type: 'INPUT_SYNCED';
      projectId: string;
      apiBaseUrl: string;
      capabilities: Partial<BackendCapabilities>;
      userId: string | null;
    }
  | {
      type: 'EXTRACTION_RECOVERED';
      artifactId: string;
      payload: Record<string, unknown>;
      briefingId?: string | null;
      fileName?: string | null;
      normalizedText?: string | null;
      parsedFormat?: 'txt' | 'md' | 'docx' | null;
    }
  | { type: 'RESET' };

const readErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

const readUploadDoneOutput = (event: unknown): UploadBriefResult | null => {
  if (!event || typeof event !== 'object' || !('output' in event)) {
    return null;
  }

  const output = (event as { output?: unknown }).output;
  if (!output || typeof output !== 'object') {
    return null;
  }

  const candidate = output as Partial<UploadBriefResult>;
  if (
    typeof candidate.briefingId !== 'string'
    || typeof candidate.fileName !== 'string'
    || typeof candidate.normalizedText !== 'string'
  ) {
    return null;
  }

  if (
    candidate.parsedFormat !== 'txt'
    && candidate.parsedFormat !== 'md'
    && candidate.parsedFormat !== 'docx'
  ) {
    return null;
  }

  return candidate as UploadBriefResult;
};

const readExtractionDoneOutput = (event: unknown): RunExtractionResult | null => {
  if (!event || typeof event !== 'object' || !('output' in event)) {
    return null;
  }

  const output = (event as { output?: unknown }).output;
  if (!output || typeof output !== 'object') {
    return null;
  }

  const candidate = output as Partial<RunExtractionResult>;
  if (
    typeof candidate.artifactId !== 'string'
    || !candidate.payload
    || typeof candidate.payload !== 'object'
    || Array.isArray(candidate.payload)
  ) {
    return null;
  }

  return {
    artifactId: candidate.artifactId,
    content: typeof candidate.content === 'string' ? candidate.content : '',
    payload: candidate.payload as Record<string, unknown>,
  };
};

export const briefingUploadMachine = setup({
  types: {
    context: {} as BriefingUploadContext,
    input: {} as BriefingUploadInput,
    events: {} as BriefingUploadEvent,
  },
  actors: {
    uploadBriefRequest: fromPromise(async ({ input }: {
      input: {
        projectId: string;
        toolKey: SupportedTool;
        file: File;
        angleDetectorFile: File | null;
        apiBaseUrl: string;
        capabilities: Partial<BackendCapabilities>;
      };
    }) => {
      return await uploadBrief(
        {
          projectId: input.projectId,
          toolKey: input.toolKey,
          file: input.file,
          ...(input.angleDetectorFile ? { angleDetectorFile: input.angleDetectorFile } : {}),
        },
        {
          apiBaseUrl: input.apiBaseUrl,
          capabilities: input.capabilities,
        },
      );
    }),
    extractBriefingRequest: fromPromise(async ({ input }: {
      input: {
        userId: string;
        projectId: string;
        toolKey: SupportedTool;
        briefingId: string;
        briefingText: string;
        extractionPayload: Record<string, unknown>;
        apiBaseUrl: string;
        capabilities: Partial<BackendCapabilities>;
      };
    }) => {
      return await runExtraction(
        {
          userId: input.userId,
          toolKey: input.toolKey,
          projectId: input.projectId,
          model: 'openrouter/auto',
          briefingId: input.briefingId,
          briefingText: input.briefingText,
          extractionPayload: input.extractionPayload,
          registrySnapshotRef: 'snapshot:default',
        },
        {
          apiBaseUrl: input.apiBaseUrl,
          capabilities: input.capabilities,
        },
      );
    }),
  },
  guards: {
    isAngleDetectorSelection: ({ event }) => event.type === 'FILE_SELECTED' && event.source === 'angle-detector',
    isAngleDetectorSelectionWithBriefing: ({ context, event }) =>
      event.type === 'FILE_SELECTED'
      && event.source === 'angle-detector'
      && !!context.file,
    isValidExtension: ({ context }) => {
      if (!context.file) {
        return false;
      }

      if (context.toolKey === 'angle-generator' && !context.angleDetectorFile) {
        return false;
      }

      const hasValidBriefing = isAllowedBriefingExtension(context.file.name);
      if (!hasValidBriefing) {
        return false;
      }

      if (context.toolKey !== 'angle-generator' || !context.angleDetectorFile) {
        return true;
      }

      return isAllowedBriefingExtension(context.angleDetectorFile.name);
    },
    canUploadBriefing: ({ context }) => {
      return context.projectId.trim().length > 0 && (
        !!context.file
        && (context.toolKey !== 'angle-generator' || !!context.angleDetectorFile)
        && isAllowedBriefingExtension(context.file.name)
        && (
          context.toolKey !== 'angle-generator'
          || (context.angleDetectorFile ? isAllowedBriefingExtension(context.angleDetectorFile.name) : false)
        )
      );
    },
    hasUserId: ({ context }) => context.userId != null,
    extractionResultIsValid: ({ context, event }) => {
      const output = readExtractionDoneOutput(event);

      return isExtractionContextValidForTool(
        context.toolKey,
        output?.payload ?? null,
        context.normalizedText,
      );
    },
  },
  actions: {
    cacheSelectedFile: assign(({ context, event }) => {
      if (event.type !== 'FILE_SELECTED') {
        return context;
      }

      if (event.source === 'angle-detector') {
        return {
          ...context,
          angleDetectorFile: event.file,
          angleDetectorFileName: event.file.name,
          briefingId: null,
          extractionArtifactId: null,
          extractionPayload: null,
          normalizedText: null,
          parsedFormat: null,
          angleDetectorNormalizedText: null,
          angleDetectorParsedFormat: null,
          error: null,
        };
      }

      return {
        ...context,
        file: event.file,
        fileName: event.file.name,
        briefingId: null,
        extractionArtifactId: null,
        extractionPayload: null,
        normalizedText: null,
        parsedFormat: null,
        angleDetectorNormalizedText: null,
        angleDetectorParsedFormat: null,
        error: null,
      };
    }),
    resetUploadState: assign(({ context }) => ({
      ...context,
      file: null,
      fileName: null,
      angleDetectorFile: null,
      angleDetectorFileName: null,
      briefingId: null,
      extractionArtifactId: null,
      extractionPayload: null,
      normalizedText: null,
      parsedFormat: null,
      angleDetectorNormalizedText: null,
      angleDetectorParsedFormat: null,
      error: null,
    })),
    syncInput: assign(({ context, event }) => {
      if (event.type !== 'INPUT_SYNCED') {
        return context;
      }

      return {
        ...context,
        projectId: event.projectId,
        apiBaseUrl: event.apiBaseUrl,
        capabilities: event.capabilities,
        userId: event.userId,
      };
    }),
    applyRecoveredExtraction: assign(({ context, event }) => {
      if (event.type !== 'EXTRACTION_RECOVERED') {
        return context;
      }

      const extractionArtifactId =
        event.artifactId && typeof event.artifactId === 'string' && event.artifactId.trim().length > 0
          ? event.artifactId
          : context.extractionArtifactId;
      const briefingId =
        event.briefingId && typeof event.briefingId === 'string' && event.briefingId.trim().length > 0
          ? event.briefingId
          : context.briefingId;
      const normalizedText =
        event.normalizedText && typeof event.normalizedText === 'string' && event.normalizedText.trim().length > 0
          ? event.normalizedText
          : context.normalizedText;

      return {
        ...context,
        extractionArtifactId: extractionArtifactId ?? null,
        extractionPayload: event.payload,
        briefingId: briefingId ?? null,
        fileName: event.fileName ?? context.fileName,
        angleDetectorFileName: context.angleDetectorFileName,
        normalizedText: normalizedText ?? null,
        parsedFormat: event.parsedFormat ?? context.parsedFormat,
        error: null,
      };
    }),
  },
}).createMachine({
  id: 'briefingUploadMachine',
  context: ({ input }) => ({
    projectId: input.projectId,
    toolKey: input.toolKey,
    apiBaseUrl: input.apiBaseUrl,
    capabilities: input.capabilities,
    userId: input.userId,
    file: null,
    fileName: null,
    angleDetectorFile: null,
    angleDetectorFileName: null,
    briefingId: null,
    extractionArtifactId: null,
    extractionPayload: null,
    normalizedText: null,
    parsedFormat: null,
    angleDetectorNormalizedText: null,
    angleDetectorParsedFormat: null,
    error: null,
  }),
  initial: 'idle',
  on: {
    INPUT_SYNCED: {
      actions: 'syncInput',
    },
  },
  states: {
    idle: {
      on: {
        FILE_SELECTED: [
          {
            guard: 'isAngleDetectorSelectionWithBriefing',
            target: 'validating',
            actions: 'cacheSelectedFile',
          },
          {
            guard: 'isAngleDetectorSelection',
            actions: 'cacheSelectedFile',
          },
          {
            target: 'validating',
            actions: 'cacheSelectedFile',
          },
        ],
        EXTRACTION_RECOVERED: {
          target: 'ready',
          actions: 'applyRecoveredExtraction',
        },
        RESET: {
          actions: 'resetUploadState',
        },
      },
    },
    validating: {
      always: [
        {
          guard: 'canUploadBriefing',
          target: 'uploading',
        },
        {
          guard: ({ context }) => !!context.file && context.projectId.trim().length === 0,
          target: 'idle',
          actions: assign({
            error: () => 'Seleziona prima un progetto',
            file: () => null,
          }),
        },
        {
          guard: ({ context }) => !!context.file && context.toolKey === 'angle-generator' && !context.angleDetectorFile,
          target: 'idle',
          actions: assign({
            error: () => 'Per angle-generator carica sia BriefingFile sia AngleDetectorFile.',
            // Keep selected briefing in context to allow progressive two-file completion.
            angleDetectorNormalizedText: () => null,
            angleDetectorParsedFormat: () => null,
          }),
        },
        {
          target: 'idle',
          actions: assign({
            error: () => 'Formato non supportato. Usa .docx, .txt o .md',
            file: () => null,
            fileName: () => null,
            angleDetectorFile: () => null,
            angleDetectorFileName: () => null,
            angleDetectorNormalizedText: () => null,
            angleDetectorParsedFormat: () => null,
          }),
        },
      ],
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetUploadState',
        },
      },
    },
    uploading: {
      invoke: {
        src: 'uploadBriefRequest',
        input: ({ context }) => ({
          projectId: context.projectId.trim(),
          toolKey: context.toolKey,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          file: context.file!,
          angleDetectorFile: context.angleDetectorFile,
          apiBaseUrl: context.apiBaseUrl,
          capabilities: context.capabilities,
        }),
        onDone: [
          {
            guard: 'hasUserId',
            target: 'extracting',
            actions: assign(({ context, event }) => {
              const output = readUploadDoneOutput(event);
              if (!output) {
                return {
                  ...context,
                  error: 'Errore durante upload',
                  file: null,
                  fileName: null,
                };
              }

              return {
                ...context,
                briefingId: output.briefingId,
                fileName: output.fileName,
                angleDetectorFileName: output.angleDetector?.fileName ?? context.angleDetectorFileName,
                normalizedText: output.normalizedText,
                parsedFormat: output.parsedFormat,
                angleDetectorNormalizedText: output.angleDetector?.normalizedText ?? null,
                angleDetectorParsedFormat: output.angleDetector?.parsedFormat ?? null,
                error: null,
              };
            }),
          },
          {
            target: 'idle',
            actions: assign(({ context }) => ({
              ...context,
              error: 'Sessione non disponibile. Ricarica la pagina.',
              file: null,
              fileName: null,
              angleDetectorFile: null,
              angleDetectorFileName: null,
              angleDetectorNormalizedText: null,
              angleDetectorParsedFormat: null,
            })),
          },
        ],
        onError: {
          target: 'idle',
          actions: assign(({ context, event }) => ({
            ...context,
            error: readErrorMessage((event as { error: unknown }).error, 'Errore durante upload'),
            file: null,
            fileName: null,
            angleDetectorFile: null,
            angleDetectorFileName: null,
            angleDetectorNormalizedText: null,
            angleDetectorParsedFormat: null,
          })),
        },
      },
      on: {
        RESET: {
          target: 'idle',
          actions: 'resetUploadState',
        },
      },
    },
    extracting: {
      on: {
        EXTRACTION_RECOVERED: {
          target: 'ready',
          actions: 'applyRecoveredExtraction',
        },
        RESET: {
          target: 'idle',
          actions: 'resetUploadState',
        },
      },
      invoke: {
        src: 'extractBriefingRequest',
        input: ({ context }) => ({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          userId: context.userId!,
          projectId: context.projectId.trim(),
          toolKey: context.toolKey,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          briefingId: context.briefingId!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          briefingText: context.toolKey === 'angle-generator' && context.angleDetectorNormalizedText
            ? `${context.normalizedText!}\n\n---\n\n${context.angleDetectorNormalizedText}`
            : context.normalizedText!,
          extractionPayload: context.toolKey === 'angle-generator'
            ? {
              knowledgeSources: [
                {
                  kind: 'briefing',
                  fileName: context.fileName,
                  parsedFormat: context.parsedFormat,
                },
                {
                  kind: 'angle-detector',
                  fileName: context.angleDetectorFileName,
                  parsedFormat: context.angleDetectorParsedFormat,
                },
              ],
            }
            : {},
          apiBaseUrl: context.apiBaseUrl,
          capabilities: context.capabilities,
        }),
        onDone: [
          {
            guard: 'extractionResultIsValid',
            target: 'ready',
            actions: assign(({ context, event }) => {
              const output = readExtractionDoneOutput(event);
              if (!output) {
                return {
                  ...context,
                  error: 'Errore durante estrazione',
                  file: null,
                  fileName: null,
                  angleDetectorFile: null,
                  angleDetectorFileName: null,
                  angleDetectorNormalizedText: null,
                  angleDetectorParsedFormat: null,
                };
              }

              return {
                ...context,
                extractionArtifactId: output.artifactId,
                extractionPayload: output.payload,
                error: null,
              };
            }),
          },
          {
            target: 'idle',
            actions: assign(({ context }) => ({
              ...context,
              file: null,
              fileName: null,
              angleDetectorFile: null,
              angleDetectorFileName: null,
              angleDetectorNormalizedText: null,
              angleDetectorParsedFormat: null,
              briefingId: null,
              extractionArtifactId: null,
              extractionPayload: null,
              normalizedText: null,
              parsedFormat: null,
              error: 'extraction_context_insufficient',
            })),
          },
        ],
        onError: {
          target: 'idle',
          actions: assign(({ context, event }) => ({
            ...context,
            error: readErrorMessage((event as { error: unknown }).error, 'Errore durante estrazione'),
            file: null,
            fileName: null,
            angleDetectorFile: null,
            angleDetectorFileName: null,
            angleDetectorNormalizedText: null,
            angleDetectorParsedFormat: null,
          })),
        },
      },
    },
    ready: {
      on: {
        FILE_SELECTED: [
          {
            guard: 'isAngleDetectorSelectionWithBriefing',
            target: 'validating',
            actions: 'cacheSelectedFile',
          },
          {
            guard: 'isAngleDetectorSelection',
            actions: 'cacheSelectedFile',
          },
          {
            target: 'validating',
            actions: 'cacheSelectedFile',
          },
        ],
        RESET: {
          target: 'idle',
          actions: 'resetUploadState',
        },
      },
    },
  },
});
