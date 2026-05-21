import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import {
  normalizeToolKeyCandidate,
  resolveGenerationWorkflowTypeCandidate,
  resolveToolWorkflowType,
  type GenerationWorkflowType,
  type ToolKey,
} from '@gen-app-2/contracts';
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
  userId?: string | null;
  userEmail?: string | null;
  user_email?: string | null;
  projectId: string;
  sessionId?: string | null;
  session_id?: string | null;
  stepKey?: string | null;
  step_key?: string | null;
  artifactRole?: 'step' | 'final' | null;
  artifact_role?: 'step' | 'final' | null;
  runMode?: 'new' | 'resume' | 'regenerate' | null;
  run_mode?: 'new' | 'resume' | 'regenerate' | null;
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

const normalizeWorkflowTypeCandidate = (
  value: unknown,
): GenerationWorkflowType | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return resolveGenerationWorkflowTypeCandidate(value);
};

const readNormalizedToolKey = (value: unknown): ToolKey | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return normalizeToolKeyCandidate(value);
};

const readToolKey = (artifact: BackendArtifact): ToolKey | null => {
  const input = artifact.input;
  const toolWorkflowInput =
    input && typeof input.toolWorkflow === 'object' && input.toolWorkflow !== null
      ? (input.toolWorkflow as Record<string, unknown>)
      : null;

  return (
    readNormalizedToolKey(artifact.toolKey) ??
    readNormalizedToolKey(input?.toolKey) ??
    readNormalizedToolKey(toolWorkflowInput?.['toolKey']) ??
    readNormalizedToolKey(toolWorkflowInput?.['workflowType']) ??
    readNormalizedToolKey(artifact.workflowType)
  );
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

const DEFAULT_ARTIFACTS_PAGE_SIZE = 200;

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
    userId: artifact.userId ?? '',
    projectId: artifact.projectId,
    artifactType: artifact.artifactType,
    model: artifact.model,
    input: artifact.input ?? {},
    toolKey,
    workflowType:
      normalizeWorkflowTypeCandidate(artifact.workflowType)
      ?? (toolKey ? resolveToolWorkflowType(toolKey) : null),
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
  const ownerEmail = readDiagnosticString(artifact.userEmail, artifact.user_email);

  const sessionId = readDiagnosticString(artifact.sessionId, artifact.session_id);
  const stepKey = readDiagnosticString(artifact.stepKey, artifact.step_key);
  const artifactRole = artifact.artifactRole ?? artifact.artifact_role ?? null;
  const runMode = artifact.runMode ?? artifact.run_mode ?? null;

  return {
    artifactId: artifact.artifactId,
    requestId: artifact.requestId,
    projectId: artifact.projectId,
    sessionId,
    stepKey,
    artifactRole,
    runMode,
    artifactType: artifact.artifactType,
    status: artifact.status,
    model: artifact.model,
    toolKey,
    workflowType: artifact.workflowType,
    ownerUsername: ownerEmail,
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
    const unboundedFilters: ArtifactQuery = {
      type: filters.type,
      status: filters.status,
      projectId: filters.projectId,
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    };
    const filteredTotal = applyQuery(options.localArtifacts ?? [], unboundedFilters).length;
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
    const totalResults = Array.isArray(payload)
      ? list.length
      : (payload.data?.totalResults ?? list.length);
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

export const listArtifactsPaginated = async (
  filters: Omit<ArtifactQuery, 'limit' | 'offset'>,
  options: ArtifactsClientOptions = {},
  pageSize = DEFAULT_ARTIFACTS_PAGE_SIZE,
): Promise<ListArtifactsResult> => {
  const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0
    ? Math.trunc(pageSize)
    : DEFAULT_ARTIFACTS_PAGE_SIZE;

  let offset = 0;
  let totalResults = 0;
  const artifacts: GenerationArtifact[] = [];

  while (true) {
    const page = await listArtifacts(
      {
        ...filters,
        limit: normalizedPageSize,
        offset,
      },
      options,
    );

    if (offset === 0) {
      totalResults = page.totalResults;
    }

    artifacts.push(...page.artifacts);

    if (page.artifacts.length === 0) {
      break;
    }

    offset += page.artifacts.length;
    if (artifacts.length >= totalResults) {
      break;
    }
  }

  return {
    artifacts,
    totalResults,
  };
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
    const detailPath = `${path}?includeInput=1&includeContent=1`;
    const payload = await requestJson<ArtifactsResponse>(joinApiPath(options.apiBaseUrl ?? '', detailPath), {
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
