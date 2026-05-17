type MockAdminSessionState = {
  role: string | null;
  userId: string;
  email: string;
  capabilities: Record<string, boolean>;
};

const defaultState: MockAdminSessionState = {
  role: 'admin',
  userId: 'admin_001',
  email: 'admin@test.com',
  capabilities: {},
};

const state: MockAdminSessionState = {
  ...defaultState,
  capabilities: { ...defaultState.capabilities },
};

export const resetMockAdminSession = (overrides: Partial<MockAdminSessionState> = {}) => {
  state.role = overrides.role ?? defaultState.role;
  state.userId = overrides.userId ?? defaultState.userId;
  state.email = overrides.email ?? defaultState.email;
  state.capabilities = { ...(overrides.capabilities ?? defaultState.capabilities) };
};

export const setMockAdminSession = (overrides: Partial<MockAdminSessionState>) => {
  if (Object.prototype.hasOwnProperty.call(overrides, 'role')) {
    state.role = overrides.role ?? null;
  }

  if (overrides.userId !== undefined) {
    state.userId = overrides.userId;
  }

  if (overrides.email !== undefined) {
    state.email = overrides.email;
  }

  if (overrides.capabilities !== undefined) {
    state.capabilities = { ...overrides.capabilities };
  }
};

export const getMockAuthSession = () => {
  return {
    session: state.role != null
      ? {
          user: {
            id: state.userId,
            email: state.email,
            role: state.role,
          },
        }
      : null,
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: state.capabilities,
  };
};