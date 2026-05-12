import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminGuard } from '../routing/admin-guard';

// Mutable session bag so individual tests can change role
const sessionBag = { role: 'member' as string | null };
const authBag = {
  capabilities: { projects: false, models: false, artifacts: false, toolsUpload: false },
};
type TestAdminUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  monthlyQuota?: number;
};

let usersDb: TestAdminUser[] = [{ id: 'u1', email: 'alice@test.com', role: 'member', status: 'active', monthlyQuota: 120 }];

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: sessionBag.role != null ? { user: { email: 'u@test.com', role: sessionBag.role } } : null,
    loading: false,
    error: null,
    apiBaseUrl: '',
    capabilities: authBag.capabilities,
  }),
}));

beforeEach(() => {
  sessionBag.role = 'member';
  usersDb = [{ id: 'u1', email: 'alice@test.com', role: 'member', status: 'active', monthlyQuota: 120 }];
  useMswHandler(http.get('/admin/users', () => HttpResponse.json(usersDb)));
  useMswHandler(http.post('/admin/users', async ({ request }) => {
    const body = await request.json() as {
      email?: string;
      role?: string;
      status?: string;
      monthlyQuota?: number;
    };

    const created = {
      id: `u${usersDb.length + 1}`,
      email: body.email ?? 'missing@test.com',
      role: body.role ?? 'member',
      status: body.status ?? 'active',
      ...(typeof body.monthlyQuota === 'number' ? { monthlyQuota: body.monthlyQuota } : {}),
    };

    usersDb = [...usersDb, created];
    return HttpResponse.json({ ok: true, data: { user: created } }, { status: 201 });
  }));
  useMswHandler(http.patch('/admin/users/:id', async ({ params, request }) => {
    const body = await request.json() as {
      email?: string;
      role?: string;
      status?: string;
      monthlyQuota?: number;
    };
    const id = String(params.id);
    const current = usersDb.find((user) => user.id === id);

    if (!current) {
      return new HttpResponse(null, { status: 404 });
    }

    const updated = {
      ...current,
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(typeof body.monthlyQuota === 'number' ? { monthlyQuota: body.monthlyQuota } : {}),
    };

    usersDb = usersDb.map((user) => (user.id === id ? updated : user));
    return HttpResponse.json({ ok: true, data: { user: updated } });
  }));
  useMswHandler(http.delete('/admin/users/:id', ({ params }) => {
    const id = String(params.id);
    usersDb = usersDb.map((user) => (
      user.id === id ? { ...user, status: 'disabled' } : user
    ));
    return new HttpResponse(null, { status: 204 });
  }));
});

describe('AdminGuard', () => {
  it('redirects to /dashboard when role is not admin', () => {
    sessionBag.role = 'member';
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
    const { findByText } = render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );
    expect(await findByText('alice@test.com')).toBeInTheDocument();
  });

  it('creates a new admin user and refreshes the list', async () => {
    const { container } = render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );

    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: 'new-member@test.com' } });
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'Secret-123' } });
    fireEvent.change(container.querySelector('input[name="monthlyQuota"]')!, { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea utente' }));

    expect(await screen.findByText('new-member@test.com')).toBeInTheDocument();
    expect(await screen.findByText('Utente creato.')).toBeInTheDocument();
  });

  it('updates an existing user inline', async () => {
    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('alice@test.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
    const editForm = screen.getByRole('heading', { name: 'Modifica utente' }).closest('form');
    expect(editForm).not.toBeNull();
    if (!editForm) {
      throw new Error('Edit form not found');
    }

    fireEvent.change(editForm.querySelector('input[type="email"]')!, { target: { value: 'alice-admin@test.com' } });
    fireEvent.change(editForm.querySelector('input[name="role"]')!, { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(await screen.findByText('alice-admin@test.com')).toBeInTheDocument();
    expect(await screen.findByText('Utente aggiornato.')).toBeInTheDocument();
    expect(await screen.findByText(/role: admin/i)).toBeInTheDocument();
  });

  it('disables an existing user', async () => {
    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('alice@test.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disabilita' }));

    await waitFor(() => {
      expect(screen.getByText(/status: disabled/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Utente disabilitato.')).toBeInTheDocument();
  });

  it('refetches remote admin users after SPA navigation remount', async () => {
    sessionBag.role = 'admin';
    let requestCount = 0;

    useMswHandler(http.get('/admin/users', () => {
      requestCount += 1;
      return HttpResponse.json([
        {
          id: `u${requestCount}`,
          email: `admin-${requestCount}@test.com`,
          role: 'admin',
          status: 'active',
        },
      ]);
    }));

    render(
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route
            path="/start"
            element={<Link to="/admin">Apri admin</Link>}
          />
          <Route path="/admin" element={<AdminUsersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Apri admin' }));
    expect(await screen.findByText('admin-1@test.com')).toBeInTheDocument();
    await waitFor(() => {
      expect(requestCount).toBe(1);
    });
  });
});
