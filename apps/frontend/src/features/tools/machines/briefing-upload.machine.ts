import { assign, fromPromise, setup, type ActorRefFrom } from 'xstate';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { isAllowedBriefingExtension } from '../../../app/runtime/shared-utils';
import { runExtraction, uploadBrief } from '../runtime/tools-client';
import { getRequiredToolInputFiles } from '../runtime/tool-form-architecture';
import type { RunExtractionResult, UploadBriefResult } from '../runtime/tools-client';
import type { SupportedTool } from './tool-flow.machine';
import { isExtractionContextValidForTool } from './extraction-context-validity';

export type BriefingUploadContext = {
  projectId: string;
  toolKey: SupportedTool;
  model: string;
  campaignObjective: string;
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
  model: string;
  campaignObjective?: string;
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
  userId: string | null;
};

export type BriefingUploadEvent =
  | { type: 'FILE_SELECTED'; file: File; sourceKey?: string }
  | { type: 'EXTRACTION_REQUESTED' }
  | {
      type: 'INPUT_SYNCED';
      projectId: string;
      model: string;
      campaignObjective?: string;
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
  | { type: 'RETRY' }
  | { type: 'RESET' };

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

const mergeMetaAdsCampaignObjective = ({
  toolKey,
  payload,
  campaignObjective,
}: {
  toolKey: SupportedTool;
  payload: Record<string, unknown>;
  campaignObjective: string;
}): Record<string, unknown> => {
  if (toolKey !== 'meta-ads') {
    return payload;
  }

  const normalizedCampaignObjective = campaignObjective.trim();
  if (normalizedCampaignObjective.length === 0) {
    return payload;
  }

  const currentValue = payload.campaign_objective;
  if (typeof currentValue === 'string' && currentValue.trim().length > 0) {
    return payload;
  }

  return {
    ...payload,
    campaign_objective: normalizedCampaignObjective,
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
        model: string;
        campaignObjective: string;
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
          model: input.model,
          briefingId: input.briefingId,
          briefingText: input.briefingText,
          extractionPayload: mergeMetaAdsCampaignObjective({
            toolKey: input.toolKey,
            payload: input.extractionPayload,
            campaignObjective: input.campaignObjective,
          }),
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
    isAngleDetectorSelection: ({ event }) => event.type === 'FILE_SELECTED' && event.sourceKey === 'angle-detector-file',
    isAngleDetectorSelectionWithBriefing: ({ context, event }) =>
      event.type === 'FILE_SELECTED'
      && event.sourceKey === 'angle-detector-file'
      && !!context.file,
    isValidExtension: ({ context }) => {
      if (!context.file) {
        return false;
      }

      const hasValidBriefing = isAllowedBriefingExtension(context.file.name);
      if (!hasValidBriefing) {
        return false;
      }

      const requiredInputFiles = getRequiredToolInputFiles(context.toolKey);
      const requiresAngleDetector = requiredInputFiles.some((entry) => entry.key === 'angle-detector-file');
      if (!requiresAngleDetector) {
        return true;
      }

      return !!context.angleDetectorFile && isAllowedBriefingExtension(context.angleDetectorFile.name);
    },
    canUploadBriefing: ({ context }) => {
      const requiredInputFiles = getRequiredToolInputFiles(context.toolKey);
      const requiresAngleDetector = requiredInputFiles.some((entry) => entry.key === 'angle-detector-file');

      return context.projectId.trim().length > 0 && (
        !!context.file
        && (!requiresAngleDetector || !!context.angleDetectorFile)
        && isAllowedBriefingExtension(context.file.name)
        && (
          !requiresAngleDetector
          || (context.angleDetectorFile ? isAllowedBriefingExtension(context.angleDetectorFile.name) : false)
        )
      );
    },
    hasUserId: ({ context }) => context.userId != null,
    extractionResultIsValid: ({ context, event }) => {
      const output = readExtractionDoneOutput(event);
      const payload = mergeMetaAdsCampaignObjective({
        toolKey: context.toolKey,
        payload: output?.payload ?? {},
        campaignObjective: context.campaignObjective,
      });

      return isExtractionContextValidForTool(
        context.toolKey,
        payload,
        context.normalizedText,
      );
    },
  },
  actions: {
    cacheSelectedFile: assign(({ context, event }) => {
      if (event.type !== 'FILE_SELECTED') {
        return context;
      }

      if (event.sourceKey === 'angle-detector-file') {
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
    })),
    syncInput: assign(({ context, event }) => {
      if (event.type !== 'INPUT_SYNCED') {
        return context;
      }

      return {
        ...context,
        projectId: event.projectId,
        model: typeof event.model === 'string' && event.model.trim().length > 0
          ? event.model
          : context.model,
        campaignObjective: event.campaignObjective ?? context.campaignObjective,
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
      };
    }),
  },
}).createMachine({
  id: 'briefingUploadMachine',
  context: ({ input }) => ({
    projectId: input.projectId,
    toolKey: input.toolKey,
    model: input.model,
    campaignObjective: input.campaignObjective ?? '',
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
  }),
  initial: 'idle',
  on: {
    INPUT_SYNCED: {
      actions: 'syncInput',
    },
  },
  states: {
    idle: {
      initial: 'clean',
      on: {
        FILE_SELECTED: {
          actions: 'cacheSelectedFile',
          target: '.clean',
        },
        EXTRACTION_REQUESTED: {
          target: 'validating',
        },
        EXTRACTION_RECOVERED: {
          target: 'ready',
          actions: 'applyRecoveredExtraction',
        },
        RESET: {
          actions: 'resetUploadState',
          target: '.clean',
        },
      },
      states: {
        clean: {},
        failed: {
          on: {
            RETRY: {
              target: 'clean',
            },
          },
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
          target: 'idle.failed',
          actions: assign({
            file: () => null,
          }),
        },
        {
          guard: ({ context }) => {
            if (!context.file) {
              return false;
            }

            const requiredInputFiles = getRequiredToolInputFiles(context.toolKey);
            const requiresAngleDetector = requiredInputFiles.some((entry) => entry.key === 'angle-detector-file');
            return requiresAngleDetector && !context.angleDetectorFile;
          },
          target: 'idle.failed',
          actions: assign({
            angleDetectorNormalizedText: () => null,
            angleDetectorParsedFormat: () => null,
          }),
        },
        {
          target: 'idle.failed',
          actions: assign({
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
          target: 'idle.clean',
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
              };
            }),
          },
          {
            target: 'idle.failed',
            actions: assign(({ context }) => ({
              ...context,
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
          target: 'idle.failed',
          actions: assign(({ context }) => ({
            ...context,
            angleDetectorNormalizedText: null,
            angleDetectorParsedFormat: null,
          })),
        },
      },
      on: {
        RESET: {
          target: 'idle.clean',
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
          target: 'idle.clean',
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
          model: context.model,
          campaignObjective: context.campaignObjective,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          briefingId: context.briefingId!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          briefingText: !!context.angleDetectorNormalizedText
            ? `${context.normalizedText!}\n\n---\n\n${context.angleDetectorNormalizedText}`
            : context.normalizedText!,
          extractionPayload: !!context.angleDetectorFileName
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
                extractionPayload: mergeMetaAdsCampaignObjective({
                  toolKey: context.toolKey,
                  payload: output.payload,
                  campaignObjective: context.campaignObjective,
                }),
              };
            }),
          },
          {
            target: 'idle.failed',
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
            })),
          },
        ],
        onError: {
          target: 'idle.failed',
          actions: assign(({ context }) => ({
            ...context,
            angleDetectorNormalizedText: null,
            angleDetectorParsedFormat: null,
          })),
        },
      },
    },
    ready: {
      on: {
        FILE_SELECTED: {
          target: 'idle.clean',
          actions: 'cacheSelectedFile',
        },
        EXTRACTION_REQUESTED: {
          target: 'validating',
        },
        RESET: {
          target: 'idle.clean',
          actions: 'resetUploadState',
        },
      },
    },
  },
});
