import { buildApiPaths } from '../../../app/runtime/api-paths';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
} from '../../../app/runtime/http-client';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { listArtifacts } from '../../artifacts/runtime/artifacts-client';

type SessionClientOptions = {
  apiBaseUrl?: string;
  capabilities?: Partial<BackendCapabilities>;
};

export type SessionArtifact = {
  artifactId: string;
  requestId: string;
  projectId: string;
  stepKey: string | null;
  artifactRole: 'step' | 'final' | null;
  runMode: 'new' | 'resume' | 'regenerate' | null;
  status: 'generating' | 'completed' | 'failed';
  content: string;
  failureReason: string | null;
  updatedAt: string;
  workflowType: string | null;
  toolKey: string | null;
};

export type SessionArtifactGroup = {
  sessionId: string;
  toolKey: string | null;
  status: 'generating' | 'completed' | 'failed';
  artifacts: SessionArtifact[];
};

export type SessionSummary = {
  sessionId: string;
  projectId: string;
  toolKey: string | null;
  status: 'generating' | 'completed' | 'failed';
  artifactCount: number;
  updatedAt: string;
};

type SessionResponse = {
  ok?: boolean;
  data?: {
    session?: SessionArtifactGroup;
    artifact?: SessionArtifact;
  };
};

type SessionsListResponse = {
  ok?: boolean;
  data?: {
    sessions?: SessionSummary[];
  };
};

const normalizeSessionId = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const deriveSessionStatus = (
  statuses: Array<'generating' | 'completed' | 'failed'>,
): 'generating' | 'completed' | 'failed' => {
  if (statuses.includes('generating')) {
    return 'generating';
  }

  if (statuses.includes('failed')) {
    return 'failed';
  }

  return 'completed';
};

export const mapArtifactsToSessionSummaryFallback = (artifacts: Awaited<ReturnType<typeof listArtifacts>>['artifacts']): SessionSummary[] => {
  const bySession = new Map<string, SessionSummary>();

  for (const artifact of artifacts) {
    const sessionId = normalizeSessionId(artifact.sessionId ?? null);
    if (!sessionId) {
      continue;
    }

    const current = bySession.get(sessionId);
    if (!current) {
      bySession.set(sessionId, {
        sessionId,
        projectId: artifact.projectId,
        toolKey: artifact.toolKey ?? null,
        status: artifact.status,
        artifactCount: 1,
        updatedAt: artifact.updatedAt,
      });
      continue;
    }

    bySession.set(sessionId, {
      ...current,
      status: deriveSessionStatus([current.status, artifact.status]),
      artifactCount: current.artifactCount + 1,
      updatedAt: Date.parse(artifact.updatedAt) > Date.parse(current.updatedAt)
        ? artifact.updatedAt
        : current.updatedAt,
    });
  }

  return [...bySession.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
};

export const listSessions = async (
  query: { projectId?: string } = {},
  options: SessionClientOptions = {},
): Promise<SessionSummary[]> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const apiPaths = buildApiPaths(capabilities);
  const listPath = apiPaths.tools.sessions.list;
  const normalizedProjectId = query.projectId && query.projectId.trim().length > 0 ? query.projectId.trim() : null;

  if (capabilities.sessionsList && listPath) {
    const searchParams = new URLSearchParams();
    if (normalizedProjectId) {
      searchParams.set('projectId', normalizedProjectId);
    }
    const queryString = searchParams.toString();
    const endpoint = `${listPath}${queryString.length > 0 ? `?${queryString}` : ''}`;
    const payload = await requestJson<SessionsListResponse>(
      joinApiPath(options.apiBaseUrl ?? '', endpoint),
      {
        method: 'GET',
        credentials: 'include',
      },
    );
    return (payload.data?.sessions ?? []).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  const result = await listArtifacts(
    {
      type: 'all',
      status: 'all',
      projectId: normalizedProjectId ?? 'all',
    },
    {
      ...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {}),
      ...(options.capabilities ? { capabilities: options.capabilities } : {}),
    },
  );

  return mapArtifactsToSessionSummaryFallback(result.artifacts);
};

export const getSessionArtifacts = async (
  sessionId: string,
  options: SessionClientOptions = {},
): Promise<SessionArtifactGroup> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const sessionPath = buildApiPaths(capabilities).tools.sessions.byId(encodeURIComponent(sessionId));

  if (!sessionPath) {
    throw new Error('Session endpoint unavailable: enable sessionsDetail capability or upgrade backend support');
  }

  try {
    const payload = await requestJson<SessionResponse>(
      joinApiPath(options.apiBaseUrl ?? '', sessionPath),
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    const session = payload.data?.session;
    if (!session) {
      throw new Error('Session response payload is missing');
    }

    return session;
  } catch (error) {
    if (isHttpClientError(error)) {
      if (error.status === 404) {
        throw new Error('Session not found');
      }
      if (error.status === 403) {
        throw new Error('Unauthorized session access');
      }
      throw new Error(`Unable to fetch session (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const getStepArtifact = async (
  sessionId: string,
  stepKey: string,
  options: SessionClientOptions = {},
): Promise<SessionArtifact> => {
  try {
    const payload = await requestJson<SessionResponse>(
      joinApiPath(
        options.apiBaseUrl ?? '',
        `/api/tools/sessions/${encodeURIComponent(sessionId)}/step/${encodeURIComponent(stepKey)}`,
      ),
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    const artifact = payload.data?.artifact;
    if (!artifact) {
      throw new Error('Step artifact response payload is missing');
    }

    return artifact;
  } catch (error) {
    if (isHttpClientError(error)) {
      if (error.status === 404) {
        throw new Error('Session step artifact not found');
      }
      if (error.status === 403) {
        throw new Error('Unauthorized step artifact access');
      }
      throw new Error(`Unable to fetch step artifact (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};
