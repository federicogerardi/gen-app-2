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
};

export const resolveBackendCapabilities = (
  overrides: Partial<BackendCapabilities> = {},
): BackendCapabilities => ({
  ...defaultBackendCapabilities,
  ...overrides,
});
