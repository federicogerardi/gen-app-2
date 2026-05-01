export type BackendCapabilities = {
  projects: boolean;
  models: boolean;
  artifacts: boolean;
  toolsUpload: boolean;
  adminModels: boolean;
};

const readFlag = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  // Railway/CI values can include accidental quotes or mixed casing.
  const normalized = value.trim().replace(/^['\"]|['\"]$/g, '').toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

export const readBackendCapabilities = (): BackendCapabilities => {
  return {
    projects: readFlag(import.meta.env.VITE_CAP_PROJECTS as string | undefined),
    models: readFlag(import.meta.env.VITE_CAP_MODELS as string | undefined),
    artifacts: readFlag(import.meta.env.VITE_CAP_ARTIFACTS as string | undefined),
    toolsUpload: readFlag(import.meta.env.VITE_CAP_TOOLS_UPLOAD as string | undefined),
    adminModels: readFlag(import.meta.env.VITE_CAP_ADMIN_MODELS as string | undefined),
  };
};

export const defaultBackendCapabilities: BackendCapabilities = {
  projects: false,
  models: false,
  artifacts: false,
  toolsUpload: false,
  adminModels: false,
};

export const resolveBackendCapabilities = (
  overrides: Partial<BackendCapabilities> = {},
): BackendCapabilities => ({
  ...defaultBackendCapabilities,
  ...overrides,
});
