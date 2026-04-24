import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  googleOAuthStartUrl,
  loginWithPassword,
  logoutSession,
  readSession,
  type AuthSession,
} from '../../features/auth/runtime/auth-client';
import {
  readBackendCapabilities,
  type BackendCapabilities,
} from '../runtime/backend-capabilities';

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
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)
    ?? DEFAULT_API_BASE;
  const capabilities = readBackendCapabilities();

  const refresh = async (): Promise<void> => {
    setLoading(true);

    try {
      const nextSession = await readSession({ apiBaseUrl });
      setSession(nextSession);
      setError(null);
    } catch (sessionError) {
      setSession(null);
      setError(sessionError instanceof Error ? sessionError.message : 'Session bootstrap failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const next = await loginWithPassword(email, password, { apiBaseUrl });
    setSession(next);
    setError(null);
  };

  const logout = async (): Promise<void> => {
    await logoutSession({ apiBaseUrl });
    setSession(null);
  };

  const value = useMemo<AuthSessionContextValue>(() => {
    return {
      apiBaseUrl,
      capabilities,
      session,
      loading,
      error,
      oauthStartUrl: googleOAuthStartUrl(apiBaseUrl),
      login,
      logout,
      refresh,
    };
  }, [apiBaseUrl, capabilities, error, loading, session]);

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
