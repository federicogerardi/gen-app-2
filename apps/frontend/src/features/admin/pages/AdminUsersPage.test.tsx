import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useMswHandler } from '../../../test/mocks/server';
import { renderAdminPage } from '../test/renderAdminPage';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminGuard } from '../routing/admin-guard';
import { getMockAuthSession, resetMockAdminSession, setMockAdminSession } from '../test/mockAdminSession';

const feedbackApiSpy = vi.hoisted(() => ({
  publishSuccess: vi.fn(),
  publishError: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
}));

type TestAdminUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  monthlyQuota?: number;
};

let usersDb: TestAdminUser[] = [{ id: 'u1', email: 'alice@test.com', role: 'member', status: 'active', monthlyQuota: 120 }];

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => getMockAuthSession(),
}));

vi.mock('../../../app/providers/FeedbackMessageProvider', () => ({
  useFeedbackMessage: () => ({
    messages: [],
    ...feedbackApiSpy,
  }),
}));

beforeEach(() => {
  feedbackApiSpy.publishSuccess.mockReset();
  feedbackApiSpy.publishError.mockReset();
  feedbackApiSpy.dismiss.mockReset();
  feedbackApiSpy.dismissAll.mockReset();

  resetMockAdminSession({
    role: 'member',
    userId: 'user_001',
    email: 'u@test.com',
    capabilities: { projects: false, models: false, artifacts: false, toolsUpload: false },
  });

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
    setMockAdminSession({ role: 'member' });
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
    setMockAdminSession({ role: 'admin' });
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
    setMockAdminSession({ role: null });
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
    renderAdminPage(<AdminUsersPage />);
    expect(screen.getByRole('heading', { name: appCopy.editorial.admin.usersTitle })).toBeInTheDocument();
  });

  it('shows error message on fetch failure', async () => {
    useMswHandler(
      http.get('/admin/users', () => new HttpResponse(null, { status: 403 })),
    );
    const { findByText } = renderAdminPage(<AdminUsersPage />);
    expect(await findByText(/403/i)).toBeInTheDocument();
  });

  it('renders users returned by API', async () => {
    const { findByText } = renderAdminPage(<AdminUsersPage />);
    expect(await findByText('alice@test.com')).toBeInTheDocument();
  });

  it('creates a new admin user and refreshes the list', async () => {
    const { container } = renderAdminPage(<AdminUsersPage />);

    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: 'new-member@test.com' } });
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'Secret-123' } });
    fireEvent.change(container.querySelector('input[name="monthlyQuota"]')!, { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea utente' }));

    expect(await screen.findByText('new-member@test.com')).toBeInTheDocument();
    expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
      appCopy.ui.feedback.adminUsersCreated,
      expect.objectContaining({ dedupeKey: 'admin-users:create:success' }),
    );
    expect(screen.queryByText('Utente creato.')).not.toBeInTheDocument();
  });

  it('updates an existing user inline', async () => {
    renderAdminPage(<AdminUsersPage />);

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
    expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
      appCopy.ui.feedback.adminUsersUpdated,
      expect.objectContaining({ dedupeKey: `admin-users:update:${usersDb[0]?.id}:success` }),
    );
    expect(await screen.findByText(/role: admin/i)).toBeInTheDocument();
  });

  it('emits global error feedback when inline update fails', async () => {
    useMswHandler(
      http.patch('/admin/users/:id', () => new HttpResponse(null, { status: 500 })),
    );

    renderAdminPage(<AdminUsersPage />);

    expect(await screen.findByText('alice@test.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));

    const editForm = screen.getByRole('heading', { name: 'Modifica utente' }).closest('form');
    expect(editForm).not.toBeNull();
    if (!editForm) {
      throw new Error('Edit form not found');
    }

    fireEvent.change(editForm.querySelector('input[type="email"]')!, { target: { value: 'alice-fail@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishError).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminUsersUpdateFailed,
        expect.objectContaining({ dedupeKey: 'admin-users:update:u1:error' }),
      );
    });
  });

  it('disables an existing user', async () => {
    renderAdminPage(<AdminUsersPage />);

    expect(await screen.findByText('alice@test.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disabilita' }));

    await waitFor(() => {
      expect(screen.getByText('Disabilitato')).toBeInTheDocument();
    });
    expect(feedbackApiSpy.publishSuccess).toHaveBeenCalledWith(
      appCopy.ui.feedback.adminUsersDisabled,
      expect.objectContaining({ dedupeKey: `admin-users:delete:${usersDb[0]?.id}:success` }),
    );
  });

  it('emits global error feedback when disable user fails', async () => {
    useMswHandler(
      http.delete('/admin/users/:id', () => new HttpResponse(null, { status: 500 })),
    );

    renderAdminPage(<AdminUsersPage />);

    expect(await screen.findByText('alice@test.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disabilita' }));

    await waitFor(() => {
      expect(feedbackApiSpy.publishError).toHaveBeenCalledWith(
        appCopy.ui.feedback.adminUsersDisableFailed,
        expect.objectContaining({ dedupeKey: 'admin-users:delete:u1:error' }),
      );
    });
  });

  it('refetches remote admin users after SPA navigation remount', async () => {
    setMockAdminSession({ role: 'admin' });
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

    renderAdminPage(
      <Routes>
        <Route
          path="/start"
          element={<Link to="/admin">Apri admin</Link>}
        />
        <Route path="/admin" element={<AdminUsersPage />} />
      </Routes>,
      { initialEntries: ['/start'] },
    );

    fireEvent.click(screen.getByRole('link', { name: 'Apri admin' }));
    expect(await screen.findByText('admin-1@test.com')).toBeInTheDocument();
    await waitFor(() => {
      expect(requestCount).toBe(1);
    });
  });
});
