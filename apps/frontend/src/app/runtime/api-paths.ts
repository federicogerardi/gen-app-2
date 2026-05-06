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
  };
  projects: {
    list: string | null;
    byId: (id: string) => string | null;
  };
  artifacts: {
    list: string | null;
    byId: (id: string) => string | null;
  };
  admin: {
    users: string;
    userById: (id: string) => string;
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
  },
  projects: {
    list: capabilities.projects ? '/api/projects' : null,
    byId: (id: string) => (capabilities.projects ? `/api/projects/${id}` : null),
  },
  artifacts: {
    list: capabilities.artifacts ? '/api/artifacts' : null,
    byId: (id: string) => (capabilities.artifacts ? `/api/artifacts/${id}` : null),
  },
  admin: {
    users: '/admin/users',
    userById: (id: string) => `/admin/users/${id}`,
  },
});
