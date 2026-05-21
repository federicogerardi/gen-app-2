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
  error: string | null;
  oauthStartUrl: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

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

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    send({ type: 'LOGIN', email, password });
  }, [send]);

  const logout = useCallback(async (): Promise<void> => {
    send({ type: 'LOGOUT' });
  }, [send]);

  const refresh = useCallback(async (): Promise<void> => {
    send({ type: 'REFRESH' });
  }, [send]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      apiBaseUrl,
      capabilities,
      session: snapshot.context.session,
      loading,
      error: snapshot.context.error,
      oauthStartUrl: googleOAuthStartUrl(apiBaseUrl),
      login,
      logout,
      refresh,
    }),
    [
      apiBaseUrl,
      capabilities,
      snapshot.context.session,
      snapshot.context.error,
      loading,
      login,
      logout,
      refresh,
    ],
  );

  return (
    <AuthSessionContext value={value}>
      {children}
    </AuthSessionContext>
  );
};

export const useAuthSession = (): AuthSessionContextValue => {
  const value = useContext(AuthSessionContext);
  if (!value) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider');
  }

  return value;
};
