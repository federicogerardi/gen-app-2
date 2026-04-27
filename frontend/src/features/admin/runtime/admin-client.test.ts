import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAdminUsers } from './admin-client';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

describe('admin-client', () => {
  describe('listAdminUsers', () => {
    it('reads users from backend success envelope', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            users: [
              { id: 'u1', email: 'alice@test.com', role: 'admin', status: 'active' },
            ],
          },
        }),
      } as Response);

      const result = await listAdminUsers();

      expect(result).toEqual([
        { id: 'u1', email: 'alice@test.com', role: 'admin', status: 'active' },
      ]);
    });

    it('still reads legacy top-level users payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          users: [
            { id: 'u2', email: 'bob@test.com', role: 'user', status: 'active' },
          ],
        }),
      } as Response);

      const result = await listAdminUsers();

      expect(result[0]?.email).toBe('bob@test.com');
    });
  });
});