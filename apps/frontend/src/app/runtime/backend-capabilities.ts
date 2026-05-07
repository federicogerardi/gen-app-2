export type BackendCapabilities = {
  projects: boolean;
  models: boolean;
  artifacts: boolean;
  sessionsList: boolean;
  sessionsDetail: boolean;
  toolsUpload: boolean;
};

const readFlag = (value: string | undefined, fallback = false): boolean => {
  if (!value) {
    return fallback;
  }

  // Railway/CI values can include accidental quotes or mixed casing.
  const normalized = value.trim().replace(/^['\"]|['\"]$/g, '').toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

export const readBackendCapabilities = (): BackendCapabilities => {
  return {
    // Projects and artifacts are core listing endpoints: default to enabled unless explicitly disabled.
    projects: readFlag(import.meta.env.VITE_CAP_PROJECTS as string | undefined, true),
    models: readFlag(import.meta.env.VITE_CAP_MODELS as string | undefined),
    artifacts: readFlag(import.meta.env.VITE_CAP_ARTIFACTS as string | undefined, true),
    sessionsList: readFlag(import.meta.env.VITE_CAP_SESSIONS_LIST as string | undefined, true),
    sessionsDetail: readFlag(import.meta.env.VITE_CAP_SESSIONS_DETAIL as string | undefined, true),
    toolsUpload: readFlag(import.meta.env.VITE_CAP_TOOLS_UPLOAD as string | undefined),
  };
};

export const defaultBackendCapabilities: BackendCapabilities = {
  projects: false,
  models: false,
  artifacts: false,
  sessionsList: false,
  sessionsDetail: false,
  toolsUpload: false,
};

export const resolveBackendCapabilities = (
  overrides: Partial<BackendCapabilities> = {},
): BackendCapabilities => ({
  ...defaultBackendCapabilities,
  ...overrides,
});
