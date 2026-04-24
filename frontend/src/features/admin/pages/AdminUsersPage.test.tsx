import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminGuard } from '../routing/admin-guard';

// Mutable session bag so individual tests can change role
const sessionBag = { role: 'user' as string | null };

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: sessionBag.role != null ? { user: { email: 'u@test.com', role: sessionBag.role } } : null,
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: { projects: false, models: false, artifacts: false, toolsUpload: false, adminModels: false },
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  sessionBag.role = 'user';
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
});

describe('AdminGuard', () => {
  it('redirects to /dashboard when role is not admin', () => {
    sessionBag.role = 'user';
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={
            <AdminGuard><div data-testid="admin-content">admin</div></AdminGuard>
          } />
          <Route path="/dashboard" element={<div data-testid="dashboard">dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).toBeNull();
  });

  it('renders children when role is admin', () => {
    sessionBag.role = 'admin';
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={
            <AdminGuard><div data-testid="admin-content">admin</div></AdminGuard>
          } />
          <Route path="/dashboard" element={<div data-testid="dashboard">dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
  });

  it('redirects to /dashboard when session is null', () => {
    sessionBag.role = null;
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={
            <AdminGuard><div data-testid="admin-content">admin</div></AdminGuard>
          } />
          <Route path="/dashboard" element={<div data-testid="dashboard">dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });
});

describe('AdminUsersPage', () => {
  it('renders Admin users heading', () => {
    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /admin users/i })).toBeInTheDocument();
  });

  it('shows error message on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    const { findByText } = render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    expect(await findByText(/403/i)).toBeInTheDocument();
  });

  it('renders users returned by API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'u1', email: 'alice@test.com', role: 'user', status: 'active' }],
    } as Response);
    const { findByText } = render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    expect(await findByText('alice@test.com')).toBeInTheDocument();
  });
});
