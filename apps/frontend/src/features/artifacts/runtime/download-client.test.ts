import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveBackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { downloadArtifactFile, downloadSessionFile } from './download-client';

const mockFetch = vi.fn();
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

describe('download-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  const options = {
    apiBaseUrl: 'http://localhost:3000',
    capabilities: resolveBackendCapabilities({
      artifactDownload: true,
      sessionDownload: true,
      sessionsDetail: true,
      toolsUpload: true,
    }),
  };

  describe('downloadArtifactFile', () => {
    it('downloads a single artifact as the specified format', async () => {
      const blob = new Blob(['content']);
      mockFetch.mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) });

      await downloadArtifactFile('artifact-1', 'md', options);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/artifacts/artifact-1/download?format=md',
        { credentials: 'include' },
      );
    });
  });

  describe('downloadSessionFile', () => {
    it('downloads a session file without excludeSteps', async () => {
      const blob = new Blob(['content']);
      mockFetch.mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) });

      await downloadSessionFile('session-1', 'docx', options);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/tools/sessions/session-1/download?format=docx',
        { credentials: 'include' },
      );
    });

    it('appends excludeSteps query param when provided (DDD-135)', async () => {
      const blob = new Blob(['content']);
      mockFetch.mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) });

      await downloadSessionFile('session-1', 'md', options, {
        excludeSteps: ['step1', 'step2'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/tools/sessions/session-1/download?format=md&excludeSteps=step1,step2',
        { credentials: 'include' },
      );
    });

    it('omits excludeSteps param when array is empty', async () => {
      const blob = new Blob(['content']);
      mockFetch.mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) });

      await downloadSessionFile('session-1', 'txt', options, { excludeSteps: [] });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/tools/sessions/session-1/download?format=txt',
        { credentials: 'include' },
      );
    });

    it('omits excludeSteps param when options is undefined', async () => {
      const blob = new Blob(['content']);
      mockFetch.mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) });

      await downloadSessionFile('session-1', 'md', options);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/tools/sessions/session-1/download?format=md',
        { credentials: 'include' },
      );
    });

    it('throws when session download capability is disabled', async () => {
      const disabledOptions = {
        ...options,
        capabilities: { ...options.capabilities, sessionDownload: false },
      };

      await expect(downloadSessionFile('session-1', 'md', disabledOptions)).rejects.toThrow(
        'Session download capability is not enabled',
      );
    });
  });
});
