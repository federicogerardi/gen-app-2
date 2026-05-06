import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
} from '../../../app/runtime/http-client';

export type ArtifactQuery = {
  type: GenerationArtifact['artifactType'] | 'all';
  status: GenerationArtifact['status'] | 'all';
  projectId: string | 'all';
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

type ArtifactsClientOptions = {
  apiBaseUrl?: string;
  capabilities?: Partial<BackendCapabilities>;
  localArtifacts?: GenerationArtifact[];
};

type BackendArtifact = {
  artifactId: string;
  requestId: string;
  projectId: string;
  artifactType: GenerationArtifact['artifactType'];
  status: GenerationArtifact['status'];
  model: string;
  toolKey?: string | null;
  workflowType: string | null;
  input?: Record<string, unknown>;
  content?: string;
  createdAt: string;
  updatedAt: string;
  // Campi diagnostici DB (opzionali: presenti solo se esposti dal backend)
  failure_reason?: string | null;
  failureReason?: string | null;
  streamed_at?: string | null;
  streamedAt?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
};

const readToolKey = (artifact: BackendArtifact): string | null => {
  if (typeof artifact.toolKey === 'string' && artifact.toolKey.trim().length > 0) {
    return artifact.toolKey.trim();
  }

  const inputToolKey = artifact.input?.['toolKey'];
  if (typeof inputToolKey === 'string' && inputToolKey.trim().length > 0) {
    return inputToolKey.trim();
  }

  return null;
};

type ArtifactsResponse =
  | BackendArtifact[]
  | {
    ok?: boolean;
    data?: {
      artifacts?: BackendArtifact[];
      artifact?: BackendArtifact;
      totalResults?: number;
    };
  };

export type ListArtifactsResult = {
  artifacts: GenerationArtifact[];
  totalResults: number;
};

const applyQuery = (artifacts: GenerationArtifact[], filters: ArtifactQuery): GenerationArtifact[] => {
  const filtered = artifacts.filter((artifact) => {
    if (filters.type && filters.type !== 'all' && artifact.artifactType !== filters.type) {
      return false;
    }

    if (filters.status && filters.status !== 'all' && artifact.status !== filters.status) {
      return false;
    }

    if (filters.projectId && filters.projectId !== 'all' && artifact.projectId !== filters.projectId) {
      return false;
    }

    if (filters.from && Date.parse(artifact.updatedAt) < Date.parse(filters.from)) {
      return false;
    }

    if (filters.to && Date.parse(artifact.updatedAt) > Date.parse(filters.to)) {
      return false;
    }

    return true;
  });

  const offset = typeof filters.offset === 'number' ? filters.offset : 0;
  const end = typeof filters.limit === 'number' ? offset + filters.limit : undefined;

  return filtered.slice(offset, end);
};

const toSourceRequest = (artifact: BackendArtifact): GenerationRequest => {
  const toolKey = readToolKey(artifact);

  return {
    requestId: artifact.requestId,
    userId: '',
    projectId: artifact.projectId,
    artifactType: artifact.artifactType,
    model: artifact.model,
    input: artifact.input ?? {},
    toolKey,
    workflowType: artifact.workflowType,
  };
};

const readDiagnosticString = (a: string | null | undefined, b: string | null | undefined): string | null => {
  if (typeof a === 'string' && a.trim().length > 0) {
    return a.trim();
  }

  if (typeof b === 'string' && b.trim().length > 0) {
    return b.trim();
  }

  return null;
};

const toGenerationArtifact = (artifact: BackendArtifact): GenerationArtifact => {
  const toolKey = readToolKey(artifact);

  return {
    artifactId: artifact.artifactId,
    requestId: artifact.requestId,
    projectId: artifact.projectId,
    artifactType: artifact.artifactType,
    status: artifact.status,
    model: artifact.model,
    toolKey,
    workflowType: artifact.workflowType,
    content: artifact.content ?? '',
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    sourceRequest: toSourceRequest(artifact),
    failureReason: readDiagnosticString(artifact.failureReason, artifact.failure_reason),
    streamedAt: readDiagnosticString(artifact.streamedAt, artifact.streamed_at),
    completedAt: readDiagnosticString(artifact.completedAt, artifact.completed_at),
  };
};

const toQueryString = (filters: ArtifactQuery): string => {
  const params = new URLSearchParams();

  if (filters.type !== 'all') {
    params.set('type', filters.type);
  }

  if (filters.status !== 'all') {
    params.set('status', filters.status);
  }

  if (filters.projectId !== 'all') {
    params.set('projectId', filters.projectId);
  }

  if (filters.from) {
    params.set('from', filters.from);
  }

  if (filters.to) {
    params.set('to', filters.to);
  }

  if (typeof filters.limit === 'number') {
    params.set('limit', String(filters.limit));
  }

  if (typeof filters.offset === 'number') {
    params.set('offset', String(filters.offset));
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
};

export const listArtifacts = async (
  filters: ArtifactQuery,
  options: ArtifactsClientOptions = {},
): Promise<ListArtifactsResult> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).artifacts.list;

  if (!path) {
    const localList = applyQuery(options.localArtifacts ?? [], filters);
    const filteredTotal = applyQuery(options.localArtifacts ?? [], {
      ...filters,
      limit: undefined,
      offset: undefined,
    }).length;
    return {
      artifacts: localList,
      totalResults: filteredTotal,
    };
  }

  try {
    const payload = await requestJson<ArtifactsResponse>(
      joinApiPath(options.apiBaseUrl ?? '', `${path}${toQueryString(filters)}`),
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    const list = Array.isArray(payload) ? payload : (payload.data?.artifacts ?? []);
    const totalResults = Array.isArray(payload) ? list.length : (payload.data?.totalResults ?? 0);
    return {
      artifacts: list.map(toGenerationArtifact),
      totalResults,
    };
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to list artifacts (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const getArtifactById = async (
  id: string,
  options: ArtifactsClientOptions = {},
): Promise<GenerationArtifact | null> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).artifacts.byId(id);

  if (!path) {
    return options.localArtifacts?.find((artifact) => artifact.artifactId === id) ?? null;
  }

  try {
    const payload = await requestJson<ArtifactsResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    const detail = Array.isArray(payload)
      ? payload.find((artifact) => artifact.artifactId === id)
      : payload.data?.artifact;

    return detail ? toGenerationArtifact(detail) : null;
  } catch (error) {
    if (isHttpClientError(error) && error.status === 404) {
      return null;
    }

    if (isHttpClientError(error)) {
      throw new Error(`Unable to load artifact detail (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};
