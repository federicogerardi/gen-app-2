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
  });
});
