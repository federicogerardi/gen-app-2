import { createActor } from 'xstate';
import { describe, expect, it, vi } from 'vitest';
import { authSessionMachine } from './auth-session.machine';
import type { AuthSession } from '../../features/auth/runtime/auth-client';
import { TEST_API_BASE_URL } from '../../test/fixtures';

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

const TEST_INPUT = { apiBaseUrl: TEST_API_BASE_URL };

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
    actor.stop();
  });

  it('bootstrap returns null → unauthenticated.idle', async () => {
    mockReadSession.mockResolvedValueOnce(null);

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'idle' }),
    );

    expect(actor.getSnapshot().context.session).toBeNull();
    actor.stop();
  });

  it('bootstrap failure → unauthenticated.failed', async () => {
    mockReadSession.mockRejectedValueOnce(new Error('Session bootstrap failed'));

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'failed' }),
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
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'idle' }),
    );

    actor.send({ type: 'LOGIN', email: 'test@example.com', password: 'pw' });
    expect(actor.getSnapshot().value).toBe('authenticating');

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('authenticated'),
    );

    expect(actor.getSnapshot().context.session).toEqual(FAKE_SESSION);
    actor.stop();
  });

  it('login failure → unauthenticated.failed', async () => {
    mockReadSession.mockResolvedValueOnce(null);
    mockLoginWithPassword.mockRejectedValueOnce(new Error('Invalid credentials'));

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'idle' }),
    );

    actor.send({ type: 'LOGIN', email: 'bad@example.com', password: 'wrong' });

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'failed' }),
    );

    expect(actor.getSnapshot().context.session).toBeNull();
    actor.stop();
  });

  it('CLEAR_ERROR from unauthenticated.failed → unauthenticated.idle', async () => {
    mockReadSession.mockResolvedValueOnce(null);
    mockLoginWithPassword.mockRejectedValueOnce(new Error('Invalid credentials'));

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    // Bootstrap → unauthenticated.idle
    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'idle' }),
    );

    // Send LOGIN to trigger failure
    actor.send({ type: 'LOGIN', email: 'bad@example.com', password: 'wrong' });

    // Wait for login failure → unauthenticated.failed
    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'failed' }),
    );

    // Clear error → back to idle
    actor.send({ type: 'CLEAR_ERROR' });

    expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'idle' });
    actor.stop();
  });

  it('LOGIN from unauthenticated.failed → authenticating (retry)', async () => {
    mockReadSession.mockResolvedValueOnce(null);
    mockLoginWithPassword.mockRejectedValueOnce(new Error('Invalid credentials'));

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    // Bootstrap → unauthenticated.idle
    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'idle' }),
    );

    // Send LOGIN to trigger failure
    actor.send({ type: 'LOGIN', email: 'bad@example.com', password: 'wrong' });

    // Login fails → unauthenticated.failed
    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'failed' }),
    );

    actor.stop();

    // Now retry with correct credentials
    mockReadSession.mockResolvedValueOnce(null);
    mockLoginWithPassword.mockResolvedValueOnce(FAKE_SESSION);

    const actor2 = createActor(authSessionMachine, { input: TEST_INPUT });
    actor2.start();

    // Bootstrap → unauthenticated.idle
    await vi.waitFor(() =>
      expect(actor2.getSnapshot().value).toEqual({ unauthenticated: 'idle' }),
    );

    // Login succeeds → authenticated
    actor2.send({ type: 'LOGIN', email: 'test@example.com', password: 'correct' });

    await vi.waitFor(() =>
      expect(actor2.getSnapshot().value).toBe('authenticated'),
    );

    expect(actor2.getSnapshot().context.session).toEqual(FAKE_SESSION);
    actor2.stop();
  });

  it('logout → unauthenticated.idle, session cleared', async () => {
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
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'idle' }),
    );

    expect(actor.getSnapshot().context.session).toBeNull();
    actor.stop();
  });

  it('logout failure → unauthenticated.failed', async () => {
    mockReadSession.mockResolvedValueOnce(FAKE_SESSION);
    mockLogoutSession.mockRejectedValueOnce(new Error('Logout failed'));

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('authenticated'),
    );

    actor.send({ type: 'LOGOUT' });

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'failed' }),
    );

    expect(actor.getSnapshot().context.session).toBeNull();
    actor.stop();
  });

  it('REFRESH from authenticated → re-reads session, stays authenticated', async () => {
    const updatedSession: AuthSession = { ...FAKE_SESSION, session: { ...FAKE_SESSION.session, lastSeenAt: '2026-06-01T00:00:00Z' } };
    mockReadSession
      .mockResolvedValueOnce(FAKE_SESSION)
      .mockResolvedValueOnce(updatedSession);

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

  it('REFRESH failure → unauthenticated.failed', async () => {
    mockReadSession
      .mockResolvedValueOnce(FAKE_SESSION)
      .mockRejectedValueOnce(new Error('Refresh failed'));

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('authenticated'),
    );

    actor.send({ type: 'REFRESH' });

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'failed' }),
    );

    expect(actor.getSnapshot().context.session).toBeNull();
    actor.stop();
  });

  it('SESSION_INVALIDATED from authenticated → unauthenticated.idle', async () => {
    mockReadSession.mockResolvedValueOnce(FAKE_SESSION);

    const actor = createActor(authSessionMachine, { input: TEST_INPUT });
    actor.start();

    await vi.waitFor(() =>
      expect(actor.getSnapshot().value).toBe('authenticated'),
    );

    actor.send({ type: 'SESSION_INVALIDATED' });

    expect(actor.getSnapshot().value).toEqual({ unauthenticated: 'idle' });
    expect(actor.getSnapshot().context.session).toBeNull();
    actor.stop();
  });
});
