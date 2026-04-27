import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import {
  streamGeneration,
  GenerationTransportError,
} from '../../generation/runtime/generation-client';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import { getArtifactById } from '../../artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
} from '../../../app/runtime/http-client';

type ToolsClientOptions = {
  apiBaseUrl?: string;
  capabilities?: Partial<BackendCapabilities>;
};

export type UploadBriefInput = {
  projectId: string;
  toolKey: string;
  file: File;
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
};

export type RunExtractionInput = {
  userId: string;
  projectId: string;
  model: string;
  toolKey: string;
  tone?: string;
  notes?: string;
  briefingId: string;
  briefingText: string;
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

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}`;
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
    };
  };

  const briefing = body.data?.briefing;
  if (!briefing) {
    throw new Error('Invalid tools upload response payload');
  }

  return briefing;
};

const parseJsonContent = (content: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
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
  try {
    const payload = await requestJson<unknown>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: input.projectId,
        toolKey: input.toolKey,
        fileName: input.file.name,
        mimeType: input.file.type || null,
        contentBase64,
      }),
    });

    return parseUploadBriefResponse(payload);
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to upload brief (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const runExtraction = async (
  input: RunExtractionInput,
  options: ToolsClientOptions = {},
): Promise<RunExtractionResult> => {
  const request: GenerationRequest = {
    requestId: randomId(),
    userId: input.userId,
    projectId: input.projectId,
    artifactType: 'extraction',
    model: input.model,
    toolKey: 'extraction',
    workflowType: 'extraction',
    input: {
      tone: input.tone ?? 'analitico',
      notes: input.notes ?? '',
      toolKey: input.toolKey,
      briefingId: input.briefingId,
      briefingText: input.briefingText,
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
    if (error instanceof GenerationTransportError) {
      throw new Error(error.message);
    }
    throw error;
  }

  const artifactId = terminalArtifactId ?? startedArtifactId;
  if (!artifactId) {
    throw new Error('Extraction finished without artifact id');
  }

  return {
    artifactId,
    content,
    payload: parseJsonContent(content),
  };
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
