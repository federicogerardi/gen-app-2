import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUserById,
  listAdminUsers,
  updateAdminUser,
} from './admin-client';

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
            { id: 'u2', email: 'bob@test.com', role: 'member', status: 'active' },
          ],
        }),
      } as Response);

      const result = await listAdminUsers();

      expect(result[0]?.email).toBe('bob@test.com');
    });
  });

  describe('getAdminUserById', () => {
    it('reads a single user from backend success envelope', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            user: { id: 'u3', email: 'carol@test.com', role: 'member', status: 'active' },
          },
        }),
      } as Response);

      const result = await getAdminUserById('u3');

      expect(result).toEqual({ id: 'u3', email: 'carol@test.com', role: 'member', status: 'active' });
    });
  });

  describe('createAdminUser', () => {
    it('posts input and returns created user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          ok: true,
          data: {
            user: { id: 'u4', email: 'new@test.com', role: 'member', status: 'active' },
          },
        }),
      } as Response);

      const result = await createAdminUser({ email: 'new@test.com', role: 'member', password: 'Secret-123' });

      expect(mockFetch).toHaveBeenCalledWith('/admin/users', expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }));
      expect(result.email).toBe('new@test.com');
    });
  });

  describe('updateAdminUser', () => {
    it('patches input and returns updated user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            user: { id: 'u5', email: 'edit@test.com', role: 'admin', status: 'active', monthlyQuota: 250 },
          },
        }),
      } as Response);

      const result = await updateAdminUser('u5', { role: 'admin', monthlyQuota: 250 });

      expect(mockFetch).toHaveBeenCalledWith('/admin/users/u5', expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
      }));
      expect(result.monthlyQuota).toBe(250);
    });
  });

  describe('deleteAdminUser', () => {
    it('sends delete request to disable user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await deleteAdminUser('u6');

      expect(mockFetch).toHaveBeenCalledWith('/admin/users/u6', expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
      }));
    });
  });
});