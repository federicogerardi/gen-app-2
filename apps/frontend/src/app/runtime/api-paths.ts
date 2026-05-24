import type { BackendCapabilities } from './backend-capabilities';

export type ApiPaths = {
  auth: {
    login: string;
    logout: string;
    session: string;
    googleStart: string;
  };
  generation: {
    stream: string;
  };
  tools: {
    briefs: string | null;
    hydrate: string | null;
    orchestrate: string | null;
    apiServicesResolve: (apiServiceId: string) => string | null;
    sessions: {
      list: string | null;
      byId: (sessionId: string) => string | null;
      byStep: (sessionId: string, stepKey: string) => string | null;
      downloadById: (sessionId: string, format: string) => string | null;
    };
  };
  projects: {
    list: string | null;
    byId: (id: string) => string | null;
  };
  artifacts: {
    list: string | null;
    byId: (id: string) => string | null;
    downloadById: (id: string, format: string) => string | null;
  };
  admin: {
    users: string;
    userById: (id: string) => string;
    apiServices: string | null;
    apiServiceById: (id: string) => string | null;
  };
  feedback: {
    changelogList: string | null;
    userReportsCreate: string | null;
    adminChangelogCreate: string | null;
    adminChangelogListAll: string | null;
    adminChangelogArchive: (id: string) => string | null;
    adminUserReportsList: string | null;
    adminUserReportById: (reportId: string) => string | null;
    adminPublishUserReportIssue: (reportId: string) => string | null;
  };
};

export const buildApiPaths = (capabilities: BackendCapabilities): ApiPaths => ({
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    session: '/auth/session',
    googleStart: '/auth/google/start',
  },
  generation: {
    stream: '/generation/stream',
  },
  tools: {
    briefs: capabilities.toolsUpload ? '/api/tools/briefs' : null,
    hydrate: capabilities.artifacts ? '/api/tools/hydrate' : null,
    orchestrate: capabilities.artifacts ? '/api/tools/orchestrate' : null,
    apiServicesResolve: (apiServiceId: string) => (
      capabilities.toolsApiServicesResolve ? `/api/tools/api-services?apiServiceId=${encodeURIComponent(apiServiceId)}` : null
    ),
    sessions: {
      list: capabilities.sessionsList ? '/api/tools/sessions' : null,
      byId: (sessionId: string) => (capabilities.sessionsDetail ? `/api/tools/sessions/${sessionId}` : null),
      byStep: (sessionId: string, stepKey: string) => (
        capabilities.sessionsDetail ? `/api/tools/sessions/${sessionId}/step/${stepKey}` : null
      ),
      downloadById: (sessionId: string, format: string) =>
        capabilities.sessionDownload ? `/api/tools/sessions/${sessionId}/download?format=${format}` : null,
    },
  },
  projects: {
    list: capabilities.projects ? '/api/projects' : null,
    byId: (id: string) => (capabilities.projects ? `/api/projects/${id}` : null),
  },
  artifacts: {
    list: capabilities.artifacts ? '/api/artifacts' : null,
    byId: (id: string) => (capabilities.artifacts ? `/api/artifacts/${id}` : null),
    downloadById: (id: string, format: string) =>
      capabilities.artifactDownload ? `/api/artifacts/${id}/download?format=${format}` : null,
  },
  admin: {
    users: '/admin/users',
    userById: (id: string) => `/admin/users/${id}`,
    apiServices: capabilities.adminApiServicesCrud ? '/api/admin/api-services' : null,
    apiServiceById: (id: string) => (
      capabilities.adminApiServicesCrud ? `/api/admin/api-services/${id}` : null
    ),
  },
  feedback: {
    changelogList: capabilities.changelogList ? '/api/changelog' : null,
    userReportsCreate: capabilities.userReportsCreate ? '/api/user-reports' : null,
    adminChangelogCreate: capabilities.adminChangelogCreate ? '/api/admin/changelog' : null,
    adminChangelogListAll: capabilities.adminChangelogCreate ? '/api/admin/changelog' : null,
    adminChangelogArchive: (id: string) => (
      capabilities.adminChangelogArchive ? `/api/admin/product-changelogs/${id}/archive` : null
    ),
    adminUserReportsList: capabilities.adminUserReportsList ? '/api/admin/user-reports' : null,
    adminUserReportById: (reportId: string) => (
      capabilities.adminUserReportsUpdate ? `/api/admin/user-reports/${reportId}` : null
    ),
    adminPublishUserReportIssue: (reportId: string) => (
      capabilities.adminUserReportsPublishIssue ? `/api/admin/user-reports/${reportId}/publish-issue` : null
    ),
  },
});
