import { describe, it, expect } from 'vitest';
import { buildApiPaths } from './api-paths';
import { resolveBackendCapabilities } from './backend-capabilities';

describe('buildApiPaths', () => {
  describe('auth paths — always available', () => {
    it('returns fixed auth paths regardless of capabilities', () => {
      const paths = buildApiPaths(resolveBackendCapabilities());
      expect(paths.auth.login).toBe('/auth/login');
      expect(paths.auth.logout).toBe('/auth/logout');
      expect(paths.auth.session).toBe('/auth/session');
      expect(paths.auth.googleStart).toBe('/auth/google/start');
    });
  });

  describe('generation stream — always available', () => {
    it('returns fixed generation stream path', () => {
      const paths = buildApiPaths(resolveBackendCapabilities());
      expect(paths.generation.stream).toBe('/generation/stream');
    });
  });

  describe('tools.briefs — capability: toolsUpload', () => {
    it('returns path when toolsUpload is enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ toolsUpload: true }));
      expect(paths.tools.briefs).toBe('/api/tools/briefs');
    });

    it('returns null when toolsUpload is disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ toolsUpload: false }));
      expect(paths.tools.briefs).toBeNull();
    });

    it('returns null when toolsUpload is missing (default)', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({}));
      expect(paths.tools.briefs).toBeNull();
    });
  });

  describe('tools.sessions — capabilities: sessionsList/sessionsDetail', () => {
    it('returns list path when sessionsList is enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ sessionsList: true }));
      expect(paths.tools.sessions.list).toBe('/api/tools/sessions');
    });

    it('returns null list path when sessionsList is disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ sessionsList: false }));
      expect(paths.tools.sessions.list).toBeNull();
    });

    it('returns detail path when sessionsDetail is enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ sessionsDetail: true }));
      expect(paths.tools.sessions.byId('sess_demo')).toBe('/api/tools/sessions/sess_demo');
    });

    it('returns step path when sessionsDetail is enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ sessionsDetail: true }));
      expect(paths.tools.sessions.byStep('sess_demo', 'optin')).toBe('/api/tools/sessions/sess_demo/step/optin');
    });

    it('returns null detail path when sessionsDetail is disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ sessionsDetail: false }));
      expect(paths.tools.sessions.byId('sess_demo')).toBeNull();
    });

    it('returns null step path when sessionsDetail is disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ sessionsDetail: false }));
      expect(paths.tools.sessions.byStep('sess_demo', 'optin')).toBeNull();
    });
  });

  describe('projects — capability: projects', () => {
    it('returns list path when projects is enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ projects: true }));
      expect(paths.projects.list).toBe('/api/projects');
    });

    it('returns null list path when projects is disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ projects: false }));
      expect(paths.projects.list).toBeNull();
    });

    it('returns byId path when projects is enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ projects: true }));
      expect(paths.projects.byId('proj-1')).toBe('/api/projects/proj-1');
    });

    it('returns null byId path when projects is disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ projects: false }));
      expect(paths.projects.byId('proj-1')).toBeNull();
    });
  });

  describe('artifacts — capability: artifacts', () => {
    it('returns list path when artifacts is enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ artifacts: true }));
      expect(paths.artifacts.list).toBe('/api/artifacts');
    });

    it('returns null list path when artifacts is disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ artifacts: false }));
      expect(paths.artifacts.list).toBeNull();
    });

    it('returns byId path when artifacts is enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ artifacts: true }));
      expect(paths.artifacts.byId('art-1')).toBe('/api/artifacts/art-1');
    });

    it('returns null byId path when artifacts is disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ artifacts: false }));
      expect(paths.artifacts.byId('art-1')).toBeNull();
    });
  });

  describe('admin paths — always available (implemented handlers)', () => {
    it('returns fixed admin users paths', () => {
      const paths = buildApiPaths(resolveBackendCapabilities());
      expect(paths.admin.users).toBe('/admin/users');
      expect(paths.admin.userById('user-1')).toBe('/admin/users/user-1');
    });

    it('returns admin api-services paths when adminApiServicesCrud is enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ adminApiServicesCrud: true }));
      expect(paths.admin.apiServices).toBe('/api/admin/api-services');
      expect(paths.admin.apiServiceById('svc-1')).toBe('/api/admin/api-services/svc-1');
      expect(paths.admin.apiServiceBindings('svc-1')).toBe('/api/admin/api-services/svc-1/bindings');
      expect(paths.admin.apiServiceBindingById('svc-1', 'bind-1')).toBe('/api/admin/api-services/svc-1/bindings/bind-1');
    });

    it('returns null admin api-services paths when adminApiServicesCrud is disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ adminApiServicesCrud: false }));
      expect(paths.admin.apiServices).toBeNull();
      expect(paths.admin.apiServiceById('svc-1')).toBeNull();
      expect(paths.admin.apiServiceBindings('svc-1')).toBeNull();
      expect(paths.admin.apiServiceBindingById('svc-1', 'bind-1')).toBeNull();
    });
  });

  describe('tools.api-services resolve — capability: toolsApiServicesResolve', () => {
    it('returns tools api-service resolver path when enabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ toolsApiServicesResolve: true }));
      expect(paths.tools.apiServicesResolve('svc_1')).toBe('/api/tools/api-services?apiServiceId=svc_1');
    });

    it('returns null tools api-service resolver path when disabled', () => {
      const paths = buildApiPaths(resolveBackendCapabilities({ toolsApiServicesResolve: false }));
      expect(paths.tools.apiServicesResolve('svc_1')).toBeNull();
    });
  });
});
