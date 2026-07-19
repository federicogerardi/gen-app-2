import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import type { ToolKey, ToolStep } from '@gen-app-2/contracts';
import {
  streamGeneration,
  GenerationTransportError,
} from '../../generation/runtime/generation-client';
import { isExtractionContextValidForTool } from '../machines/extraction-context-validity';
import type { SupportedTool } from '../machines/tool-flow.machine';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import { getArtifactById } from '../../artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import {
  parseExtractionArtifactContent,
  readExtractionPayloadFromArtifact,
} from '../../generation/runtime/step-hydration';
import { normalizeExtractionFieldKeysForTool } from './extraction-field-matrix';
import { getRequiredToolInputFiles } from './tool-form-architecture';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
} from '../../../app/runtime/http-client';
import { generateRequestId } from '../../../app/runtime/shared-utils';
import { appCopy } from '../../../app/copy/system';
import { v4 as uuidv4 } from 'uuid';

const normalizeExtractionModel = (model: string): GenerationRequest['model'] => {
  const normalized = model.trim();
  if (normalized.length === 0) {
    return 'openrouter/auto';
  }

  if (normalized.includes('/')) {
    return normalized as GenerationRequest['model'];
  }

  if (normalized.includes(':')) {
    const [provider, ...rest] = normalized.split(':');
    if (provider && rest.length > 0) {
      return `${provider}/${rest.join(':')}` as GenerationRequest['model'];
    }
  }

  return `openrouter/${normalized}` as GenerationRequest['model'];
};

type ToolsClientOptions = {
  apiBaseUrl?: string;
  capabilities?: Partial<BackendCapabilities>;
};

export type UploadBriefInput = {
  projectId: string;
  toolKey: SupportedTool;
  file: File;
  angleDetectorFile?: File | null;
};

export type UploadBriefAngleDetectorResult = {
  fileName: string;
  mimeType: string | null;
  size: number;
  parsedFormat: 'txt' | 'md' | 'docx';
  normalizedText: string;
  charCount: number;
  wordCount: number;
};

export type UploadBriefResult = {
  briefingId: string;
  projectId: string;
  toolKey: string | null;
  fileName: string;
  mimeType: string | null;
  size: number;
  parsedFormat: 'txt' | 'md' | 'docx';
  normalizedText: string;
  charCount: number;
  wordCount: number;
  angleDetector?: UploadBriefAngleDetectorResult;
  knowledgeSourcesCount?: number;
};

export type RunExtractionInput = {
  userId: string;
  projectId: string;
  model: string;
  toolKey: ToolKey;
  tone?: string;
  notes?: string;
  briefingId: string;
  briefingText: string;
  extractionPayload?: Record<string, unknown>;
  extractionArtifactId?: string | null;
  stepDependencyArtifactIds?: string[];
  idempotencyKey?: string;
  registrySnapshotRef?: string;
};

export type RunExtractionResult = {
  artifactId: string;
  content: string;
  payload: Record<string, unknown>;
};

const toBase64 = async (file: File): Promise<string> => {
  if (typeof file.arrayBuffer !== 'function') {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read file content'));
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const [, base64 = ''] = result.split(',');
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });
  }

  const bytes = await file.arrayBuffer();
  const uint8 = new Uint8Array(bytes);
  let binary = '';
  uint8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
};

const parseUploadBriefResponse = (payload: unknown): UploadBriefResult => {
  const body = payload as {
    ok?: boolean;
    data?: {
      briefing?: UploadBriefResult;
      angleDetector?: UploadBriefAngleDetectorResult;
      knowledgeSourcesCount?: number;
    };
  };

  const briefing = body.data?.briefing;
  if (!briefing) {
    throw new Error('Invalid tools upload response payload');
  }

  const angleDetector = body.data?.angleDetector;
  return {
    ...briefing,
    ...(angleDetector ? { angleDetector } : {}),
    ...(angleDetector ? { knowledgeSourcesCount: body.data?.knowledgeSourcesCount ?? 2 } : {}),
  };
};

const resolveExtractionPayloadFromArtifact = (artifact: GenerationArtifact): Record<string, unknown> => {
  // Canonical read path: delegates to step-hydration which checks BE envelope first.
  const canonical = readExtractionPayloadFromArtifact(artifact);
  if (Object.keys(canonical).length > 0) {
    return canonical;
  }

  // Fallback: attempt multi-envelope content parsing for live-stream results
  // that were built from raw SSE chunk accumulation (not yet persisted as an artifact).
  return parseExtractionArtifactContent(artifact.content);
};

const mapExtractionFailureReasonToCode = (reason: string): string => {
  const normalized = reason.trim();
  if (
    normalized === 'stream_empty_output'
    || normalized === 'extraction_empty_output'
    || normalized === 'extraction_context_insufficient'
  ) {
    return 'extraction_context_insufficient';
  }

  return normalized;
};

const readHttpClientErrorMessage = (details: unknown): string | null => {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const candidate = details as { error?: { message?: unknown } };
  const message = candidate.error?.message;
  return typeof message === 'string' && message.trim().length > 0 ? message : null;
};

const assertExtractionResultIsValid = (
  toolKey: ToolKey,
  payload: Record<string, unknown>,
  normalizedText: string,
): Record<string, unknown> => {
  const normalizedPayload = normalizeExtractionFieldKeysForTool(toolKey, payload);

  if (
    isExtractionContextValidForTool(
      toolKey as SupportedTool,
      normalizedPayload,
      normalizedText,
    )
  ) {
    return normalizedPayload;
  }

  throw new Error('extraction_context_insufficient');
};

export const uploadBrief = async (
  input: UploadBriefInput,
  options: ToolsClientOptions = {},
): Promise<UploadBriefResult> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).tools.briefs;
  if (!path) {
    throw new Error('Tools upload capability is disabled');
  }

  const contentBase64 = await toBase64(input.file);
  const requiredInputFiles = getRequiredToolInputFiles(input.toolKey);
  const hasRequiredAngleDetector = requiredInputFiles.some((entry) => entry.key === 'angle-detector-file');
  const isDualSourceTool = input.toolKey === 'meta-ads';
  const angleDetectorFile = input.angleDetectorFile;

  if (hasRequiredAngleDetector && !angleDetectorFile) {
    throw new Error(appCopy.ui.toolPage.runtimeErrors.requiredFilesMissing);
  }

  const bodyPayload = isDualSourceTool
    ? {
      projectId: input.projectId,
      toolKey: input.toolKey,
      briefing: {
        fileName: input.file.name,
        mimeType: input.file.type || null,
        contentBase64,
      },
      angleDetector: {
        fileName: angleDetectorFile?.name ?? null,
        mimeType: angleDetectorFile?.type || null,
        contentBase64: angleDetectorFile ? await toBase64(angleDetectorFile) : null,
      },
    }
    : {
      projectId: input.projectId,
      toolKey: input.toolKey,
      fileName: input.file.name,
      mimeType: input.file.type || null,
      contentBase64,
    };

  try {
    const correlationId = uuidv4();
    const payload = await requestJson<unknown>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(bodyPayload),
    });

    return parseUploadBriefResponse(payload);
  } catch (error) {
    if (isHttpClientError(error)) {
      const backendMessage = readHttpClientErrorMessage(error.details);
      throw new Error(
        backendMessage
          ? `Unable to upload brief (HTTP ${error.status ?? 'unknown'}): ${backendMessage}`
          : `Unable to upload brief (HTTP ${error.status ?? 'unknown'})`,
      );
    }

    throw error;
  }
};

export const runExtraction = async (
  input: RunExtractionInput,
  options: ToolsClientOptions = {},
): Promise<RunExtractionResult> => {
  const request: GenerationRequest = {
    requestId: generateRequestId(),
    userId: input.userId,
    projectId: input.projectId,
    artifactType: 'extraction',
    model: normalizeExtractionModel(input.model),
    toolKey: 'extraction',
    workflowType: 'extraction',
    input: {
      tone: 'analitico',
      notes: input.notes ?? '',
      toolKey: input.toolKey,
      briefingId: input.briefingId,
      briefingText: input.briefingText,
      extractionPayload: input.extractionPayload ?? {},
      extractionArtifactId: input.extractionArtifactId ?? null,
      stepDependencyArtifactIds: input.stepDependencyArtifactIds ?? [],
    },
    outputFormat: 'json',
    registrySnapshotRef: input.registrySnapshotRef ?? 'snapshot:default',
  };

  if (input.idempotencyKey) {
    request.idempotencyKey = input.idempotencyKey;
  }

  let startedArtifactId: string | null = null;
  let terminalArtifactId: string | null = null;
  let content = '';

  try {
    await streamGeneration(request, {
      ...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {}),
      onEvent: (event) => {
        if (event.event === 'start') {
          startedArtifactId = event.data.artifactId;
          return;
        }

        if (event.event === 'chunk') {
          content += event.data.chunk;
          return;
        }

        if (event.event === 'terminal') {
          terminalArtifactId = event.data.artifactId;
        }
      },
    });
  } catch (error) {
    // Recovery: if the stream dropped mid-transport (e.g. proxy restart, Railway disconnect)
    // but we already received the `start` event, the backend may have completed and persisted
    // the artifact. Attempt to fetch it before surfacing the error to the user.
    // Not applied to `terminal_failed` (server explicitly reported failure) or errors
    // without a known artifact ID (stream dropped before `start`).
    if (
      error instanceof GenerationTransportError &&
      error.code === 'transport_mid_stream' &&
      startedArtifactId
    ) {
      const recovered = await getExtractionArtifact(startedArtifactId, options).catch(() => null);
      if (recovered?.content) {
        return {
          artifactId: recovered.artifactId,
          content: recovered.content,
          payload: resolveExtractionPayloadFromArtifact(recovered),
        };
      }
    }

    if (error instanceof GenerationTransportError) {
      if (error.code === 'terminal_failed') {
        const mappedCode = mapExtractionFailureReasonToCode(error.message);
        if (mappedCode !== error.message) {
          console.debug('[tools-client] mapped extraction terminal reason', {
            rawReason: error.message,
            mappedReason: mappedCode,
          });
        }
        throw new Error(mappedCode);
      }

      throw new Error(error.message);
    }
    throw error;
  }

  const artifactId = terminalArtifactId ?? startedArtifactId;
  if (!artifactId) {
    throw new Error('Extraction finished without artifact id');
  }

  // Some environments can complete extraction with start+terminal events only,
  // without chunk payloads. In that case recover payload from persisted artifact.
  if (content.trim().length === 0) {
    const recovered = await getExtractionArtifact(artifactId, options).catch(() => null);
    if (recovered) {
      const payload = assertExtractionResultIsValid(
        input.toolKey,
        resolveExtractionPayloadFromArtifact(recovered),
        input.briefingText,
      );
      return {
        artifactId: recovered.artifactId,
        content: recovered.content,
        payload,
      };
    }

    throw new Error('extraction_context_insufficient');
  }

  const parsedPayload = parseExtractionArtifactContent(content);
  if (Object.keys(parsedPayload).length === 0) {
    const recovered = await getExtractionArtifact(artifactId, options).catch(() => null);
    if (recovered) {
      const payload = assertExtractionResultIsValid(
        input.toolKey,
        resolveExtractionPayloadFromArtifact(recovered),
        input.briefingText,
      );
      return {
        artifactId: recovered.artifactId,
        content,
        payload,
      };
    }

    throw new Error('extraction_context_insufficient');
  }

  const normalizedPayload = assertExtractionResultIsValid(
    input.toolKey,
    parsedPayload,
    input.briefingText,
  );

  return {
    artifactId,
    content,
    payload: normalizedPayload,
  };
};

export type OrchestrationResult = {
  toolKey: ToolKey;
  targetStep: ToolStep;
  stepDependencyArtifactIds: string[];
  dependencyArtifactIdsByStep: Partial<Record<ToolStep, string>>;
};

export const orchestrateToolStep = async (
  projectId: string,
  toolKey: ToolKey,
  targetStep: ToolStep,
  options: ToolsClientOptions = {},
): Promise<OrchestrationResult> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).tools.orchestrate;
  if (!path) {
    throw new Error('Tools orchestrate capability is disabled');
  }

  const payload = await requestJson<{ ok: boolean; data: { orchestration: OrchestrationResult } }>(
    joinApiPath(options.apiBaseUrl ?? '', path),
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, toolKey, targetStep }),
    },
  );

  const orchestration = payload.data?.orchestration;
  if (!orchestration) {
    throw new Error('Invalid tools orchestrate response payload');
  }

  return orchestration;
};

export const getExtractionArtifact = async (
  artifactId: string,
  options: ToolsClientOptions = {},
): Promise<GenerationArtifact | null> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  return getArtifactById(artifactId, {
    ...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {}),
    capabilities,
  });
};
