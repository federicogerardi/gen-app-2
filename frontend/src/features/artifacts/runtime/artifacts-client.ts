import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import type { GenerationRequest } from '../../generation/contracts/backend-stream';

export type ArtifactQuery = {
  type: GenerationArtifact['artifactType'] | 'all';
  status: GenerationArtifact['status'] | 'all';
  projectId: string | 'all';
  from?: string;
  to?: string;
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
  workflowType: string | null;
  input?: Record<string, unknown>;
  content?: string;
  createdAt: string;
  updatedAt: string;
};

type ArtifactsResponse =
  | BackendArtifact[]
  | {
    ok?: boolean;
    data?: {
      artifacts?: BackendArtifact[];
      artifact?: BackendArtifact;
    };
  };

const joinApiPath = (baseUrl: string, path: string): string => {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}${path}`;
};

const applyQuery = (artifacts: GenerationArtifact[], filters: ArtifactQuery): GenerationArtifact[] => {
  return artifacts.filter((artifact) => {
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
};

const toSourceRequest = (artifact: BackendArtifact): GenerationRequest => {
  return {
    requestId: artifact.requestId,
    userId: '',
    projectId: artifact.projectId,
    artifactType: artifact.artifactType,
    model: artifact.model,
    input: artifact.input ?? {},
    workflowType: artifact.workflowType,
  };
};

const toGenerationArtifact = (artifact: BackendArtifact): GenerationArtifact => {
  return {
    artifactId: artifact.artifactId,
    requestId: artifact.requestId,
    projectId: artifact.projectId,
    artifactType: artifact.artifactType,
    status: artifact.status,
    model: artifact.model,
    toolKey: null,
    workflowType: artifact.workflowType,
    content: artifact.content ?? '',
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    sourceRequest: toSourceRequest(artifact),
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

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
};

export const listArtifacts = async (
  filters: ArtifactQuery,
  options: ArtifactsClientOptions = {},
): Promise<GenerationArtifact[]> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).artifacts.list;

  if (!path) {
    return applyQuery(options.localArtifacts ?? [], filters);
  }

  const response = await fetch(joinApiPath(options.apiBaseUrl ?? '', `${path}${toQueryString(filters)}`), {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Unable to list artifacts (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as ArtifactsResponse;
  const list = Array.isArray(payload) ? payload : (payload.data?.artifacts ?? []);
  return list.map(toGenerationArtifact);
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

  const response = await fetch(joinApiPath(options.apiBaseUrl ?? '', path), {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to load artifact detail (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as ArtifactsResponse;
  const detail = Array.isArray(payload)
    ? payload.find((artifact) => artifact.artifactId === id)
    : payload.data?.artifact;

  return detail ? toGenerationArtifact(detail) : null;
};
