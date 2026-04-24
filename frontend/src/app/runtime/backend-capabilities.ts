export type BackendCapabilities = {
  projects: boolean;
  models: boolean;
  artifacts: boolean;
  toolsUpload: boolean;
  adminModels: boolean;
};

const readFlag = (value: string | undefined): boolean => value === '1' || value === 'true';

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
