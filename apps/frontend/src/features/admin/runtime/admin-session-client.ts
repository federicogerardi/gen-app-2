import {
  isHttpClientError,
  joinApiPath,
  requestJson,
} from '../../../app/runtime/http-client';
import type { SessionArtifactGroup } from '../../tools/runtime/session-client';

type AdminSessionClientOptions = {
  apiBaseUrl?: string;
};

export type AdminSessionSummary = {
  sessionId: string;
  userId: string | null;
  userEmail: string | null;
  projectId: string;
  projectName: string | null;
  toolKey: string | null;
  status: 'generating' | 'completed' | 'failed';
  artifactCount: number;
  updatedAt: string;
};

type AdminSessionsListResponse = {
  ok?: boolean;
  data?: {
    sessions?: AdminSessionSummary[];
    nextCursor?: string;
  };
};

type AdminSessionResponse = {
  ok?: boolean;
  data?: {
    session?: SessionArtifactGroup;
  };
};

export const listAdminSessions = async (
  query: { projectId?: string } = {},
  options: AdminSessionClientOptions = {},
): Promise<AdminSessionSummary[]> => {
  const searchParams = new URLSearchParams();
  const normalizedProjectId = query.projectId && query.projectId.trim().length > 0 ? query.projectId.trim() : null;
  if (normalizedProjectId) {
    searchParams.set('projectId', normalizedProjectId);
  }
  const queryString = searchParams.toString();
  const endpoint = `/api/admin/sessions${queryString.length > 0 ? `?${queryString}` : ''}`;

  const payload = await requestJson<AdminSessionsListResponse>(
    joinApiPath(options.apiBaseUrl ?? '', endpoint),
    {
      method: 'GET',
      credentials: 'include',
    },
  );

  return (payload.data?.sessions ?? []).sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
};

export const getAdminSessionArtifacts = async (
  sessionId: string,
  options: AdminSessionClientOptions = {},
): Promise<SessionArtifactGroup> => {
  const endpoint = `/api/admin/sessions/${encodeURIComponent(sessionId)}?includeContent=1`;

  try {
    const payload = await requestJson<AdminSessionResponse>(
      joinApiPath(options.apiBaseUrl ?? '', endpoint),
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
      throw new Error(`Unable to fetch admin session (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const downloadAdminSession = async (
  sessionId: string,
  format: 'md' | 'txt' | 'docx',
  options: AdminSessionClientOptions = {},
): Promise<void> => {
  const endpoint = `/api/admin/sessions/${encodeURIComponent(sessionId)}/download?format=${format}`;

  const response = await fetch(
    joinApiPath(options.apiBaseUrl ?? '', endpoint),
    {
      method: 'GET',
      credentials: 'include',
    },
  );

  if (!response.ok) {
    throw new Error(`Download failed (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `session-${sessionId}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
