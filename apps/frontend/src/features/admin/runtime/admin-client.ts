import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import type { AuthUserRole, AuthUserStatus } from '../../auth/runtime/auth-client';
import {
  isHttpClientError,
  joinApiPath,
  requestJson,
  requestVoid,
} from '../../../app/runtime/http-client';

export type AdminUser = {
  id: string;
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  monthlyQuota?: number;
  monthlyUsed?: number;
};

export type CreateAdminUserInput = {
  email: string;
  role?: AuthUserRole;
  status?: AuthUserStatus;
  password?: string;
  monthlyQuota?: number;
  monthlyUsed?: number;
};

export type UpdateAdminUserInput = {
  email?: string;
  role?: AuthUserRole;
  status?: AuthUserStatus;
  password?: string;
  monthlyQuota?: number;
  monthlyUsed?: number;
};

type AdminClientOptions = {
  apiBaseUrl?: string;
  capabilities?: Partial<BackendCapabilities>;
};

type AdminUsersResponse =
  | AdminUser[]
  | {
    user?: AdminUser;
    users?: AdminUser[];
    data?: {
      user?: AdminUser;
      users?: AdminUser[];
    };
  };
const readAdminUsers = (payload: AdminUsersResponse): AdminUser[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const users = payload.users ?? payload.data?.users;
  if (users) {
    return users;
  }

  const user = payload.user ?? payload.data?.user;
  return user ? [user] : [];
};

const readAdminUser = (payload: AdminUsersResponse): AdminUser | null => {
  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  return payload.user ?? payload.data?.user ?? readAdminUsers(payload)[0] ?? null;
};

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

    return readAdminUsers(payload);
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

    return readAdminUser(payload);
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

export const createAdminUser = async (
  input: CreateAdminUserInput,
  options: AdminClientOptions = {},
): Promise<AdminUser> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.users;

  try {
    const payload = await requestJson<AdminUsersResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const created = readAdminUser(payload);
    if (!created) {
      throw new Error('Unable to create admin user (invalid payload)');
    }

    return created;
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to create admin user (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const updateAdminUser = async (
  id: string,
  input: UpdateAdminUserInput,
  options: AdminClientOptions = {},
): Promise<AdminUser> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.userById(id);

  try {
    const payload = await requestJson<AdminUsersResponse>(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const updated = readAdminUser(payload);
    if (!updated) {
      throw new Error('Unable to update admin user (invalid payload)');
    }

    return updated;
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to update admin user (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const deleteAdminUser = async (
  id: string,
  options: AdminClientOptions = {},
): Promise<void> => {
  const capabilities = resolveBackendCapabilities(options.capabilities);
  const path = buildApiPaths(capabilities).admin.userById(id);

  try {
    await requestVoid(joinApiPath(options.apiBaseUrl ?? '', path), {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Unable to delete admin user (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};


