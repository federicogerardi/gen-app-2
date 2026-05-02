import { assign, fromPromise, setup } from 'xstate';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { runExtraction, uploadBrief } from '../runtime/tools-client';
import { isAllowedBriefingExtension } from '../runtime/tool-form-architecture';
import type { SupportedTool } from './tool-flow.machine';

export type BriefingUploadContext = {
  projectId: string;
  toolKey: SupportedTool;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
  userId: string | null;
  file: File | null;
  fileName: string | null;
  briefingId: string | null;
  extractionArtifactId: string | null;
  extractionPayload: Record<string, unknown> | null;
  normalizedText: string | null;
  parsedFormat: 'txt' | 'md' | 'docx' | null;
  error: string | null;
};

type BriefingUploadInput = {
  projectId: string;
  toolKey: SupportedTool;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
  userId: string | null;
};

type BriefingUploadEvent =
  | { type: 'FILE_SELECTED'; file: File }
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
    }
  | { type: 'RESET' };

const readErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
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
        apiBaseUrl: string;
        capabilities: Partial<BackendCapabilities>;
      };
    }) => {
      return await uploadBrief(
        {
          projectId: input.projectId,
          toolKey: input.toolKey,
          file: input.file,
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
    isValidExtension: ({ context }) => {
      if (!context.file) {
        return false;
      }

      return isAllowedBriefingExtension(context.file.name);
    },
    hasValidProject: ({ context }) => context.projectId.trim().length > 0,
    hasUserId: ({ context }) => context.userId != null,
  },
  actions: {
    cacheSelectedFile: assign({
      file: ({ event }) => (event.type === 'FILE_SELECTED' ? event.file : null),
      fileName: () => null,
      briefingId: () => null,
      extractionArtifactId: () => null,
      extractionPayload: () => null,
      normalizedText: () => null,
      parsedFormat: () => null,
      error: () => null,
    }),
    resetUploadState: assign(({ context }) => ({
      ...context,
      file: null,
      fileName: null,
      briefingId: null,
      extractionArtifactId: null,
      extractionPayload: null,
      normalizedText: null,
      parsedFormat: null,
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

      return {
        ...context,
        extractionArtifactId: event.artifactId,
        extractionPayload: event.payload,
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
    briefingId: null,
    extractionArtifactId: null,
    extractionPayload: null,
    normalizedText: null,
    parsedFormat: null,
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
        FILE_SELECTED: {
          target: 'validating',
          actions: 'cacheSelectedFile',
        },
        RESET: {
          actions: 'resetUploadState',
        },
      },
    },
    validating: {
      always: [
        {
          guard: ({ context }) =>
            !!context.file
            && isAllowedBriefingExtension(context.file.name)
            && context.projectId.trim().length > 0,
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
          target: 'idle',
          actions: assign({
            error: () => 'Formato non supportato. Usa .docx, .txt o .md',
            file: () => null,
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
          apiBaseUrl: context.apiBaseUrl,
          capabilities: context.capabilities,
        }),
        onDone: [
          {
            guard: 'hasUserId',
            target: 'extracting',
            actions: assign(({ context, event }) => {
              const doneEvent = event as unknown as {
                output: {
                  briefingId: string;
                  fileName: string;
                  normalizedText: string;
                  parsedFormat: 'txt' | 'md' | 'docx';
                };
              };

              return {
                ...context,
                briefingId: doneEvent.output.briefingId,
                fileName: doneEvent.output.fileName,
                normalizedText: doneEvent.output.normalizedText,
                parsedFormat: doneEvent.output.parsedFormat,
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
          briefingText: context.normalizedText!,
          apiBaseUrl: context.apiBaseUrl,
          capabilities: context.capabilities,
        }),
        onDone: {
          target: 'ready',
          actions: assign(({ context, event }) => {
            const doneEvent = event as unknown as {
              output: {
                artifactId: string;
                payload: Record<string, unknown>;
              };
            };

            return {
              ...context,
              extractionArtifactId: doneEvent.output.artifactId,
              extractionPayload: doneEvent.output.payload,
              error: null,
            };
          }),
        },
        onError: {
          target: 'idle',
          actions: assign(({ context, event }) => ({
            ...context,
            error: readErrorMessage((event as { error: unknown }).error, 'Errore durante estrazione'),
            file: null,
            fileName: null,
          })),
        },
      },
    },
    ready: {
      on: {
        FILE_SELECTED: {
          target: 'validating',
          actions: 'cacheSelectedFile',
        },
        RESET: {
          target: 'idle',
          actions: 'resetUploadState',
        },
      },
    },
  },
});
