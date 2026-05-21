import { buildApiPaths } from '../../../app/runtime/api-paths';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
} from '../../../app/runtime/http-client';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';

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
  createdAt?: string;
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
    nextCursor?: string;
  };
};

const getSessionSortTimestamp = (session: Pick<SessionSummary, 'createdAt' | 'updatedAt'>): number => {
  return Date.parse(session.createdAt ?? session.updatedAt);
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
    return (payload.data?.sessions ?? []).sort((a, b) => getSessionSortTimestamp(b) - getSessionSortTimestamp(a));
  }

  throw new Error('Session listing unavailable: enable sessionsList capability or upgrade backend support');
};

export const getSessionArtifacts = async (
  sessionId: string,
  options: SessionClientOptions = {},
): Promise<SessionArtifactGroup> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const baseSessionPath = buildApiPaths(capabilities).tools.sessions.byId(encodeURIComponent(sessionId));
  const sessionPath = baseSessionPath
    ? `${baseSessionPath}?includeContent=1`
    : null;

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
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const baseStepPath = buildApiPaths(capabilities).tools.sessions.byStep(
    encodeURIComponent(sessionId),
    encodeURIComponent(stepKey),
  );
  const stepPath = baseStepPath
    ? `${baseStepPath}?includeContent=1`
    : null;

  if (!stepPath) {
    throw new Error('Session endpoint unavailable: enable sessionsDetail capability or upgrade backend support');
  }

  try {
    const payload = await requestJson<SessionResponse>(
      joinApiPath(
        options.apiBaseUrl ?? '',
        stepPath,
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
