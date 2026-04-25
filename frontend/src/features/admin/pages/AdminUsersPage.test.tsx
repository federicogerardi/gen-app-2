import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
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

beforeEach(() => {
  sessionBag.role = 'user';
  useMswHandler(
    http.get('/admin/users', () => HttpResponse.json([])),
  );
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
    expect(screen.getByRole('heading', { name: appCopy.editorial.admin.usersTitle })).toBeInTheDocument();
  });

  it('shows error message on fetch failure', async () => {
    useMswHandler(
      http.get('/admin/users', () => new HttpResponse(null, { status: 403 })),
    );
    const { findByText } = render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    expect(await findByText(/403/i)).toBeInTheDocument();
  });

  it('renders users returned by API', async () => {
    useMswHandler(
      http.get('/admin/users', () => HttpResponse.json([
        { id: 'u1', email: 'alice@test.com', role: 'user', status: 'active' },
      ])),
    );
    const { findByText } = render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    expect(await findByText('alice@test.com')).toBeInTheDocument();
  });
});
