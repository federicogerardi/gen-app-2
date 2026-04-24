import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProjects, getProjectById } from './projects-client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('projects-client', () => {
  describe('listProjects', () => {
    it('returns empty list when capability disabled', async () => {
      const result = await listProjects({ capabilities: { projects: false } });
      expect(result).toEqual([]);
    });

    it('fetches from API when capability enabled', async () => {
      const apiResult = [{ id: 'p1', name: 'API Project', description: '', updatedAt: '' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { projects: apiResult } }),
      } as Response);

      const result = await listProjects({ capabilities: { projects: true } });
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(result).toEqual(apiResult);
    });

    it('throws on non-ok response when capability enabled', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
      await expect(listProjects({ capabilities: { projects: true } })).rejects.toThrow('500');
    });
  });

  describe('getProjectById', () => {
    it('fetches detail from API when capability enabled', async () => {
      const project = { id: 'p1', name: 'API Project', description: '', updatedAt: '' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: { project } }),
      } as Response);

      const result = await getProjectById('p1', { capabilities: { projects: true } });
      expect(result).toEqual(project);
    });

    it('returns null from fallback when project not found', async () => {
      const result = await getProjectById('unknown-id', { capabilities: { projects: false } });
      expect(result).toBeNull();
    });
  });
});
