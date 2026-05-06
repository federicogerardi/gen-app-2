import {
  isHttpClientError,
  joinApiPath,
  requestJson,
  requestVoid,
} from '../../../app/runtime/http-client';

export const AUTH_USER_ROLES = ['admin', 'member'] as const;
export type AuthUserRole = (typeof AUTH_USER_ROLES)[number];

export const AUTH_USER_STATUSES = ['active', 'disabled', 'pending_password_reset'] as const;
export type AuthUserStatus = (typeof AUTH_USER_STATUSES)[number];

type AuthErrorShape = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type SessionData = {
  authenticated: boolean;
  user: {
    id: string;
    email: string;
    role: AuthUserRole;
    status: AuthUserStatus;
  };
  session: {
    id: string;
    authMethod: string;
    expiresAt: string;
    lastSeenAt: string;
  };
};

type AuthSuccessShape<TData> = {
  ok: true;
  data: TData;
};

export type AuthSession = SessionData;

type AuthRequestOptions = {
  apiBaseUrl?: string;
};

export const loginWithPassword = async (
  email: string,
  password: string,
  options: AuthRequestOptions = {},
): Promise<AuthSession> => {
  const apiBaseUrl = options.apiBaseUrl ?? '';
  try {
    const body = await requestJson<AuthSuccessShape<SessionData>>(joinApiPath(apiBaseUrl, '/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    return body.data;
  } catch (error) {
    if (isHttpClientError(error)) {
      const details = error.details as AuthErrorShape | null;
      if (details?.error?.message) {
        throw new Error(details.error.message);
      }
    }

    throw error;
  }
};

export const readSession = async (
  options: AuthRequestOptions = {},
): Promise<AuthSession | null> => {
  const apiBaseUrl = options.apiBaseUrl ?? '';
  try {
    const body = await requestJson<AuthSuccessShape<SessionData>>(joinApiPath(apiBaseUrl, '/auth/session'), {
      method: 'GET',
      credentials: 'include',
    });
    return body.data;
  } catch (error) {
    if (isHttpClientError(error) && error.status === 401) {
      return null;
    }

    if (isHttpClientError(error)) {
      throw new Error(`Unable to bootstrap session (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const logoutSession = async (options: AuthRequestOptions = {}): Promise<void> => {
  const apiBaseUrl = options.apiBaseUrl ?? '';
  try {
    await requestVoid(joinApiPath(apiBaseUrl, '/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    if (isHttpClientError(error)) {
      throw new Error(`Logout failed (HTTP ${error.status ?? 'unknown'})`);
    }

    throw error;
  }
};

export const googleOAuthStartUrl = (apiBaseUrl: string): string => {
  return joinApiPath(apiBaseUrl, '/auth/google/start');
};
