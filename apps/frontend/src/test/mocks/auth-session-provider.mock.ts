import { vi } from 'vitest';

type MockAuthSessionConfig = {
  role?: 'admin' | 'member' | null;
  userId?: string;
  email?: string;
  capabilities?: Record<string, boolean>;
  apiBaseUrl?: string;
  session?: { user: Record<string, unknown> } | null;
};

export const createMockAuthSessionProvider = (config?: MockAuthSessionConfig) => {
  const role = config?.role ?? 'member';
  const userId = config?.userId ?? 'user-001';
  const email = config?.email ?? 'user@test.com';
  const capabilities = config?.capabilities ?? {};
  const apiBaseUrl = config?.apiBaseUrl ?? '';

  const session = config?.session !== undefined
    ? config.session
    : role !== null
      ? { user: { id: userId, email, role } }
      : null;

  return {
    useAuthSession: () => ({
      session,
      loading: false,
      hasError: false,
      apiBaseUrl,
      capabilities,
      oauthStartUrl: '',
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      clearError: vi.fn(),
    }),
    useAuthState: () => ({
      session,
      loading: false,
      hasError: false,
    }),
    useAuthActions: () => ({
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      clearError: vi.fn(),
    }),
    useApiConfig: () => ({
      apiBaseUrl,
      capabilities,
    }),
    useOAuthUrl: () => ({
      oauthStartUrl: '',
    }),
  };
};
