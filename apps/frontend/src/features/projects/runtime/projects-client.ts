import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
} from '../../../app/runtime/http-client';

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
};

// Fallback policy decision (2026-04-25): no demo data when projects capability is disabled.
export const PROJECTS_FALLBACK_POLICY = 'empty-fallback-when-capability-disabled';

type ProjectsClientOptions = {
  apiBaseUrl?: string;
  capabilities?: Partial<BackendCapabilities>;
};

type ProjectsListResponse =
  | ProjectSummary[]
  | {
    ok?: boolean;
    data?: {
      projects?: ProjectSummary[];
      project?: ProjectSummary;
    };
  };

export const listProjects = async (
  options: ProjectsClientOptions = {},
): Promise<ProjectSummary[]> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).projects.list;

  if (!path) {
    return [];
  }

  try {
    const payload = await requestJson<ProjectsListResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    if (Array.isArray(payload)) {
      return payload;
    }

    return payload.data?.projects ?? [];
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to list projects (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const getProjectById = async (
  id: string,
  options: ProjectsClientOptions = {},
): Promise<ProjectSummary | null> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).projects.byId(id);

  if (!path) {
    const all = await listProjects(options);
    return all.find((item) => item.id === id) ?? null;
  }

  try {
    const payload = await requestJson<ProjectsListResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    if (Array.isArray(payload)) {
      return payload.find((item) => item.id === id) ?? null;
    }

    return payload.data?.project ?? null;
  } catch (error) {
    if (isHttpClientError(error) && error.status === 404) {
      return null;
    }

    if (isHttpClientError(error)) {
      throw new Error(`Unable to load project detail (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const createProject = async (
  input: { name: string; description: string },
  options: ProjectsClientOptions = {},
): Promise<ProjectSummary> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).projects.list;

  if (!path) {
    throw new Error('Projects capability is disabled');
  }

  try {
    const payload = await requestJson<ProjectsListResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (Array.isArray(payload)) {
      return payload[0] as ProjectSummary;
    }

    const created = payload.data?.project;
    if (!created) {
      throw new Error('Unable to create project (invalid payload)');
    }

    return created;
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to create project (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};
