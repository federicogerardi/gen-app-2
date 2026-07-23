export type BackendCapabilities = {
  projects: boolean;
  models: boolean;
  artifacts: boolean;
  sessionsList: boolean;
  sessionsDetail: boolean;
  toolsUpload: boolean;
  artifactDownload: boolean;
  sessionDownload: boolean;
  changelogList: boolean;
  userReportsCreate: boolean;
  adminChangelogCreate: boolean;
  adminChangelogArchive: boolean;
  adminUserReportsList: boolean;
  adminUserReportsUpdate: boolean;
  adminUserReportsPublishIssue: boolean;
  adminApiServicesCrud: boolean;
  toolsApiServicesResolve: boolean;
  toolsJobSystem: boolean;
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
    artifactDownload: readFlag(import.meta.env.VITE_CAP_ARTIFACT_DOWNLOAD as string | undefined),
    sessionDownload: readFlag(import.meta.env.VITE_CAP_SESSION_DOWNLOAD as string | undefined),
    changelogList: readFlag(import.meta.env.VITE_CAP_CHANGELOG_LIST as string | undefined, true),
    userReportsCreate: readFlag(import.meta.env.VITE_CAP_USER_REPORTS_CREATE as string | undefined, true),
    adminChangelogCreate: readFlag(import.meta.env.VITE_CAP_ADMIN_CHANGELOG_CREATE as string | undefined, true),
    adminChangelogArchive: readFlag(import.meta.env.VITE_CAP_ADMIN_CHANGELOG_ARCHIVE as string | undefined, true),
    adminUserReportsList: readFlag(import.meta.env.VITE_CAP_ADMIN_USER_REPORTS_LIST as string | undefined, true),
    adminUserReportsUpdate: readFlag(import.meta.env.VITE_CAP_ADMIN_USER_REPORTS_UPDATE as string | undefined, true),
    adminUserReportsPublishIssue: readFlag(import.meta.env.VITE_CAP_ADMIN_USER_REPORTS_PUBLISH_ISSUE as string | undefined, true),
    adminApiServicesCrud: readFlag(import.meta.env.VITE_CAP_ADMIN_API_SERVICES_CRUD as string | undefined, true),
    toolsApiServicesResolve: readFlag(import.meta.env.VITE_CAP_TOOLS_API_SERVICES_RESOLVE as string | undefined, true),
    toolsJobSystem: readFlag(import.meta.env.VITE_CAP_TOOLS_JOB_SYSTEM as string | undefined),
  };
};

export const defaultBackendCapabilities: BackendCapabilities = {
  projects: false,
  models: false,
  artifacts: false,
  sessionsList: false,
  sessionsDetail: false,
  toolsUpload: false,
  artifactDownload: false,
  sessionDownload: false,
  changelogList: false,
  userReportsCreate: false,
  adminChangelogCreate: false,
  adminChangelogArchive: false,
  adminUserReportsList: false,
  adminUserReportsUpdate: false,
  adminUserReportsPublishIssue: false,
    adminApiServicesCrud: false,
    toolsApiServicesResolve: false,
    toolsJobSystem: false,
};

/**
 * @deprecated Use domain-specific capability resolvers instead:
 * - `resolveAdminCapabilities()` for admin-related flags
 * - `resolveToolsCapabilities()` for tools-related flags
 * - `resolveArtifactCapabilities()` for artifact-related flags
 * - `resolveProjectCapabilities()` for project-related flags
 * - `resolveFeedbackCapabilities()` for feedback-related flags
 *
 * This function will be removed in a future version. Migration deadline: 2026-Q1.
 * See DDD-154 for rationale.
 */
export const resolveBackendCapabilities = (
  overrides: Partial<BackendCapabilities> = {},
): BackendCapabilities => ({
  ...defaultBackendCapabilities,
  ...overrides,
});

// DDD-154: Domain-specific capability projections
export type AdminCapabilities = Pick<BackendCapabilities,
  | 'adminChangelogCreate'
  | 'adminChangelogArchive'
  | 'adminUserReportsList'
  | 'adminUserReportsUpdate'
  | 'adminUserReportsPublishIssue'
  | 'adminApiServicesCrud'
>;

export type ToolsCapabilities = Pick<BackendCapabilities,
  | 'toolsUpload'
  | 'toolsApiServicesResolve'
  | 'toolsJobSystem'
>;

export type ArtifactCapabilities = Pick<BackendCapabilities,
  | 'artifacts'
  | 'artifactDownload'
  | 'sessionDownload'
  | 'sessionsList'
  | 'sessionsDetail'
>;

export type ProjectCapabilities = Pick<BackendCapabilities, 'projects'>;

export type FeedbackCapabilities = Pick<BackendCapabilities,
  | 'changelogList'
  | 'userReportsCreate'
>;

export const resolveAdminCapabilities = (
  overrides: Partial<AdminCapabilities> = {},
): AdminCapabilities => {
  const full = resolveBackendCapabilities(overrides);
  return {
    adminChangelogCreate: full.adminChangelogCreate,
    adminChangelogArchive: full.adminChangelogArchive,
    adminUserReportsList: full.adminUserReportsList,
    adminUserReportsUpdate: full.adminUserReportsUpdate,
    adminUserReportsPublishIssue: full.adminUserReportsPublishIssue,
    adminApiServicesCrud: full.adminApiServicesCrud,
  };
};

export const resolveToolsCapabilities = (
  overrides: Partial<ToolsCapabilities> = {},
): ToolsCapabilities => {
  const full = resolveBackendCapabilities(overrides);
  return {
    toolsUpload: full.toolsUpload,
    toolsApiServicesResolve: full.toolsApiServicesResolve,
    toolsJobSystem: full.toolsJobSystem,
  };
};

export const resolveArtifactCapabilities = (
  overrides: Partial<ArtifactCapabilities> = {},
): ArtifactCapabilities => {
  const full = resolveBackendCapabilities(overrides);
  return {
    artifacts: full.artifacts,
    artifactDownload: full.artifactDownload,
    sessionDownload: full.sessionDownload,
    sessionsList: full.sessionsList,
    sessionsDetail: full.sessionsDetail,
  };
};

export const resolveProjectCapabilities = (
  overrides: Partial<ProjectCapabilities> = {},
): ProjectCapabilities => {
  const full = resolveBackendCapabilities(overrides);
  return {
    projects: full.projects,
  };
};

export const resolveFeedbackCapabilities = (
  overrides: Partial<FeedbackCapabilities> = {},
): FeedbackCapabilities => {
  const full = resolveBackendCapabilities(overrides);
  return {
    changelogList: full.changelogList,
    userReportsCreate: full.userReportsCreate,
  };
};
