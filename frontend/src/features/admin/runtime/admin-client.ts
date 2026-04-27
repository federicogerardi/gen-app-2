import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
} from '../../../app/runtime/http-client';

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  status: string;
};

export type AdminModel = {
  key: string;
  status: string;
};

export type AdminActivity = {
  artifactId: string;
  projectId: string;
  status: string;
  updatedAt: string;
};

type AdminClientOptions = {
  apiBaseUrl?: string;
  capabilities?: Partial<BackendCapabilities>;
};

type AdminUsersResponse = AdminUser[] | { users?: AdminUser[] };
type AdminModelsResponse = AdminModel[] | { models?: AdminModel[] };
type AdminActivityResponse = AdminActivity[] | { activity?: AdminActivity[] };

export const listAdminUsers = async (
  options: AdminClientOptions = {},
): Promise<AdminUser[]> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.users;

  try {
    const payload = await requestJson<AdminUsersResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    return Array.isArray(payload) ? payload : (payload.users ?? []);
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to list admin users (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const getAdminUserById = async (
  id: string,
  options: AdminClientOptions = {},
): Promise<AdminUser | null> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.userById(id);

  try {
    const payload = await requestJson<AdminUsersResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    const users = Array.isArray(payload) ? payload : (payload.users ?? []);
    return users.find((user) => user.id === id) ?? null;
  } catch (error) {
    if (isHttpClientError(error) && error.status === 404) {
      return null;
    }

    if (isHttpClientError(error)) {
      throw new Error(`Unable to load admin user detail (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const listAdminModels = async (
  options: AdminClientOptions = {},
): Promise<AdminModel[]> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.models;
  if (!path) {
    return [];
  }

  try {
    const payload = await requestJson<AdminModelsResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    return Array.isArray(payload) ? payload : (payload.models ?? []);
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to list admin models (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const listAdminActivity = async (
  options: AdminClientOptions = {},
): Promise<AdminActivity[]> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.activity;

  try {
    const payload = await requestJson<AdminActivityResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'GET',
      credentials: 'include',
    });

    return Array.isArray(payload) ? payload : (payload.activity ?? []);
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to list admin activity (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};
