import { describe, it, expect } from 'vitest';
import {
  defaultBackendCapabilities,
  resolveBackendCapabilities,
  type BackendCapabilities,
} from './backend-capabilities';

describe('backend-capabilities', () => {
  it('defaultBackendCapabilities has all capabilities set to false', () => {
    const keys = Object.keys(defaultBackendCapabilities) as (keyof BackendCapabilities)[];
    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((key) => {
      expect(defaultBackendCapabilities[key]).toBe(false);
    });
  });

  it('resolveBackendCapabilities returns defaults when no overrides', () => {
    const result = resolveBackendCapabilities();
    expect(result).toEqual(defaultBackendCapabilities);
  });

  it('resolveBackendCapabilities applies partial overrides', () => {
    const result = resolveBackendCapabilities({ projects: true });
    expect(result.projects).toBe(true);
    expect(result.artifacts).toBe(false);
    expect(result.models).toBe(false);
  });

  it('resolveBackendCapabilities supports full override', () => {
    const all: BackendCapabilities = {
      projects: true,
      models: true,
      artifacts: true,
      toolsUpload: true,
      adminModels: true,
    };
    const result = resolveBackendCapabilities(all);
    expect(result).toEqual(all);
  });

  it('fallback is deterministic: missing capability always false', () => {
    const r1 = resolveBackendCapabilities({});
    const r2 = resolveBackendCapabilities({});
    expect(r1).toEqual(r2);
    expect(r1.adminModels).toBe(false);
  });
});
