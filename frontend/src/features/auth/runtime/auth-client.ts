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
    role: string;
    status: string;
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

const joinApiPath = (baseUrl: string, path: string): string => {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}${path}`;
};

const readJson = async <TData>(response: Response): Promise<TData> => {
  return (await response.json()) as TData;
};

export const loginWithPassword = async (
  email: string,
  password: string,
  options: AuthRequestOptions = {},
): Promise<AuthSession> => {
  const apiBaseUrl = options.apiBaseUrl ?? '';
  const response = await fetch(joinApiPath(apiBaseUrl, '/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await readJson<AuthErrorShape>(response);
    throw new Error(body.error.message);
  }

  const body = await readJson<AuthSuccessShape<SessionData>>(response);
  return body.data;
};

export const readSession = async (
  options: AuthRequestOptions = {},
): Promise<AuthSession | null> => {
  const apiBaseUrl = options.apiBaseUrl ?? '';
  const response = await fetch(joinApiPath(apiBaseUrl, '/auth/session'), {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to bootstrap session (HTTP ${response.status})`);
  }

  const body = await readJson<AuthSuccessShape<SessionData>>(response);
  return body.data;
};

export const logoutSession = async (options: AuthRequestOptions = {}): Promise<void> => {
  const apiBaseUrl = options.apiBaseUrl ?? '';
  const response = await fetch(joinApiPath(apiBaseUrl, '/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Logout failed (HTTP ${response.status})`);
  }
};

export const googleOAuthStartUrl = (apiBaseUrl: string): string => {
  return joinApiPath(apiBaseUrl, '/auth/google/start');
};
