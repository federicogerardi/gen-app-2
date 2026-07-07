import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useMachine } from '@xstate/react';
import {
  googleOAuthStartUrl,
  type AuthSession,
} from '../../features/auth/runtime/auth-client';
import {
  readBackendCapabilities,
  type BackendCapabilities,
} from '../runtime/backend-capabilities';
import { authSessionMachine } from '../machines/auth-session.machine';

const DEFAULT_API_BASE = '';

type AuthSessionContextValue = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  session: AuthSession | null;
  loading: boolean;
  hasError: boolean;
  oauthStartUrl: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
};

// DDD-153: Specialized hook types for focused concerns
export type AuthStateValue = Pick<AuthSessionContextValue, 'session' | 'loading' | 'hasError'>;
export type AuthActionsValue = Pick<AuthSessionContextValue, 'login' | 'logout' | 'refresh' | 'clearError'>;
export type ApiConfigValue = Pick<AuthSessionContextValue, 'apiBaseUrl' | 'capabilities'>;
export type OAuthUrlValue = Pick<AuthSessionContextValue, 'oauthStartUrl'>;

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

type AuthSessionProviderProps = {
  children: ReactNode;
};

export const AuthSessionProvider = ({ children }: AuthSessionProviderProps) => {
  const apiBaseUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)
    ?? DEFAULT_API_BASE;
  const capabilities = useMemo(() => readBackendCapabilities(), []);

  const [snapshot, send] = useMachine(authSessionMachine, {
    input: { apiBaseUrl },
  });

  const loading =
    snapshot.matches('bootstrapping') ||
    snapshot.matches('authenticating') ||
    snapshot.matches('loggingOut') ||
    snapshot.matches('refreshing');

  const hasError = snapshot.matches({ unauthenticated: 'failed' });

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    send({ type: 'LOGIN', email, password });
  }, [send]);

  const logout = useCallback(async (): Promise<void> => {
    send({ type: 'LOGOUT' });
  }, [send]);

  const refresh = useCallback(async (): Promise<void> => {
    send({ type: 'REFRESH' });
  }, [send]);

  const clearError = useCallback((): void => {
    send({ type: 'CLEAR_ERROR' });
  }, [send]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      apiBaseUrl,
      capabilities,
      session: snapshot.context.session,
      loading,
      hasError,
      oauthStartUrl: googleOAuthStartUrl(apiBaseUrl),
      login,
      logout,
      refresh,
      clearError,
    }),
    [
      apiBaseUrl,
      capabilities,
      snapshot.context.session,
      hasError,
      loading,
      login,
      logout,
      refresh,
      clearError,
    ],
  );

  return (
    <AuthSessionContext value={value}>
      {children}
    </AuthSessionContext>
  );
};

/**
 * @deprecated Use specialized hooks instead:
 * - `useAuthState()` for session, loading, hasError
 * - `useAuthActions()` for login, logout, refresh, clearError
 * - `useApiConfig()` for apiBaseUrl, capabilities
 * - `useOAuthUrl()` for oauthStartUrl
 *
 * This hook will be removed in a future version. Migration deadline: 2026-Q1.
 * See DDD-153 for rationale.
 */
export const useAuthSession = (): AuthSessionContextValue => {
  const value = useContext(AuthSessionContext);
  if (!value) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider');
  }

  return value;
};

// DDD-153: Specialized hooks for focused concerns
export const useAuthState = (): AuthStateValue => {
  const { session, loading, hasError } = useAuthSession();
  return { session, loading, hasError };
};

export const useAuthActions = (): AuthActionsValue => {
  const { login, logout, refresh, clearError } = useAuthSession();
  return { login, logout, refresh, clearError };
};

export const useApiConfig = (): ApiConfigValue => {
  const { apiBaseUrl, capabilities } = useAuthSession();
  return { apiBaseUrl, capabilities };
};

export const useOAuthUrl = (): OAuthUrlValue => {
  const { oauthStartUrl } = useAuthSession();
  return { oauthStartUrl };
};
