import { createActor } from 'xstate';
import { describe, expect, it, vi } from 'vitest';
import { authSessionMachine } from './auth-session.machine';
import type { AuthSession } from '../../features/auth/runtime/auth-client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../features/auth/runtime/auth-client', () => ({
  readSession: vi.fn(),
  loginWithPassword: vi.fn(),
  logoutSession: vi.fn(),
}));

import {
  readSession,
  loginWithPassword,
  logoutSession,
} from '../../features/auth/runtime/auth-client';

const mockReadSession = vi.mocked(readSession);
const mockLoginWithPassword = vi.mocked(loginWithPassword);
const mockLogoutSession = vi.mocked(logoutSession);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_SESSION: AuthSession = {
  authenticated: true,
  user: {
    id: 'user-1',
    email: 'test@example.com',
    role: 'member',
    status: 'active',
  },
  session: {
    id: 'session-1',
    authMethod: 'password',
    expiresAt: '2099-01-01T00:00:00Z',
    lastSeenAt: '2026-01-01T00:00:00Z',
  },
};

const TEST_INPUT = { apiBaseUrl: 'http://localhost:3001' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authSessionMachine', () => {
  it('bootstrap success → authenticated with session in context', async () => {
    mockReadSession.mockResolvedValueOnce(FAKE_SESSION);

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    expect(actor.getSnapshot().value).toBe('bootstrapping');

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('authenticated'),
    );

    expect(actor.getSnapshot().context.session).toEqual(FAKE_SESSION);
    expect(actor.getSnapshot().context.error).toBeNull();
    actor.stop();
  });

  it('bootstrap returns null → unauthenticated', async () => {
    mockReadSession.mockResolvedValueOnce(null);

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('unauthenticated'),
    );

    expect(actor.getSnapshot().context.session).toBeNull();
    actor.stop();
  });

  it('login success → authenticated with session', async () => {
    mockReadSession.mockResolvedValueOnce(null);
    mockLoginWithPassword.mockResolvedValueOnce(FAKE_SESSION);

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('unauthenticated'),
    );

    actor.send({ type: 'LOGIN', email: 'test@example.com', password: 'pw' });
    expect(actor.getSnapshot().value).toBe('authenticating');

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('authenticated'),
    );

    expect(actor.getSnapshot().context.session).toEqual(FAKE_SESSION);
    expect(actor.getSnapshot().context.error).toBeNull();
    actor.stop();
  });

  it('login failure → unauthenticated with error in context', async () => {
    mockReadSession.mockResolvedValueOnce(null);
    mockLoginWithPassword.mockRejectedValueOnce(new Error('Invalid credentials'));

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('unauthenticated'),
    );

    actor.send({ type: 'LOGIN', email: 'bad@example.com', password: 'wrong' });

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('unauthenticated'),
    );

    expect(actor.getSnapshot().context.session).toBeNull();
    expect(actor.getSnapshot().context.error).toBe('Invalid credentials');
    actor.stop();
  });

  it('logout → unauthenticated, session cleared', async () => {
    mockReadSession.mockResolvedValueOnce(FAKE_SESSION);
    mockLogoutSession.mockResolvedValueOnce(undefined);

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('authenticated'),
    );

    actor.send({ type: 'LOGOUT' });
    expect(actor.getSnapshot().value).toBe('loggingOut');

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('unauthenticated'),
    );

    expect(actor.getSnapshot().context.session).toBeNull();
    actor.stop();
  });

  it('REFRESH from authenticated → re-reads session, stays authenticated', async () => {
    const updatedSession: AuthSession = { ...FAKE_SESSION, session: { ...FAKE_SESSION.session, lastSeenAt: '2026-06-01T00:00:00Z' } };
    mockReadSession
      .mockResolvedValueOnce(FAKE_SESSION)   // bootstrap
      .mockResolvedValueOnce(updatedSession);  // refresh

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('authenticated'),
    );

    actor.send({ type: 'REFRESH' });
    expect(actor.getSnapshot().value).toBe('refreshing');

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('authenticated'),
    );

    expect(actor.getSnapshot().context.session).toEqual(updatedSession);
    actor.stop();
  });
});
