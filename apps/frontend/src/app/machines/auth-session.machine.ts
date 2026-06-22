import { assign, fromPromise, setup } from 'xstate';
import {
  loginWithPassword,
  logoutSession,
  readSession,
  type AuthSession,
} from '../../features/auth/runtime/auth-client';

// ── Types ────────────────────────────────────────────────────────────────────

export type AuthSessionContext = {
  session: AuthSession | null;
  apiBaseUrl: string;
};

export type AuthSessionInput = {
  apiBaseUrl: string;
};

export type AuthSessionEvent =
  | { type: 'LOGIN'; email: string; password: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH' }
  | { type: 'SESSION_INVALIDATED' }
  | { type: 'CLEAR_ERROR' };

// ── Actor logic ───────────────────────────────────────────────────────────────

type ReadSessionInput = { apiBaseUrl: string };
type LoginInput = { email: string; password: string; apiBaseUrl: string };
type LogoutInput = { apiBaseUrl: string };

// ── Machine ───────────────────────────────────────────────────────────────────

export const authSessionMachine = setup({
  types: {
    context: {} as AuthSessionContext,
    input: {} as AuthSessionInput,
    events: {} as AuthSessionEvent,
  },
  actors: {
    readSessionActor: fromPromise<AuthSession | null, ReadSessionInput>(
      ({ input }) => readSession({ apiBaseUrl: input.apiBaseUrl }),
    ),
    loginActor: fromPromise<AuthSession, LoginInput>(
      ({ input }) =>
        loginWithPassword(input.email, input.password, {
          apiBaseUrl: input.apiBaseUrl,
        }),
    ),
    logoutActor: fromPromise<void, LogoutInput>(
      ({ input }) => logoutSession({ apiBaseUrl: input.apiBaseUrl }),
    ),
  },
}).createMachine({
  id: 'authSession',
  context: ({ input }) => ({
    session: null,
    apiBaseUrl: input.apiBaseUrl,
  }),
  initial: 'bootstrapping',
  states: {
    // ── Bootstrap ─────────────────────────────────────────────────────────────
    bootstrapping: {
      invoke: {
        src: 'readSessionActor',
        input: ({ context }) => ({ apiBaseUrl: context.apiBaseUrl }),
        onDone: [
          {
            guard: ({ event }) => event.output !== null,
            target: 'authenticated',
            actions: assign(({ event }) => ({
              session: event.output,
            })),
          },
          {
            target: 'unauthenticated.idle',
            actions: assign(() => ({ session: null })),
          },
        ],
        onError: {
          target: 'unauthenticated.failed',
          actions: assign(() => ({ session: null })),
        },
      },
    },

    // ── Authenticated ─────────────────────────────────────────────────────────
    authenticated: {
      on: {
        LOGOUT: 'loggingOut',
        REFRESH: 'refreshing',
        SESSION_INVALIDATED: {
          target: 'unauthenticated.idle',
          actions: assign(() => ({ session: null })),
        },
      },
    },

    // ── Unauthenticated ───────────────────────────────────────────────────────
    unauthenticated: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            LOGIN: '#authSession.authenticating',
            REFRESH: '#authSession.refreshing',
          },
        },
        failed: {
          on: {
            LOGIN: '#authSession.authenticating',
            CLEAR_ERROR: 'idle',
            REFRESH: '#authSession.refreshing',
          },
        },
      },
    },

    // ── Authenticating (login in progress) ────────────────────────────────────
    authenticating: {
      invoke: {
        src: 'loginActor',
        input: ({ context, event }) => {
          const loginEvent = event as {
            type: 'LOGIN';
            email: string;
            password: string;
          };
          return {
            email: loginEvent.email,
            password: loginEvent.password,
            apiBaseUrl: context.apiBaseUrl,
          };
        },
        onDone: {
          target: 'authenticated',
          actions: assign(({ event }) => ({
            session: event.output,
          })),
        },
        onError: {
          target: 'unauthenticated.failed',
          actions: assign(() => ({ session: null })),
        },
      },
    },

    // ── Logging out ───────────────────────────────────────────────────────────
    loggingOut: {
      invoke: {
        src: 'logoutActor',
        input: ({ context }) => ({ apiBaseUrl: context.apiBaseUrl }),
        onDone: {
          target: 'unauthenticated.idle',
          actions: assign(() => ({ session: null })),
        },
        onError: {
          target: 'unauthenticated.failed',
          actions: assign(() => ({ session: null })),
        },
      },
    },

    // ── Refreshing ────────────────────────────────────────────────────────────
    refreshing: {
      invoke: {
        src: 'readSessionActor',
        input: ({ context }) => ({ apiBaseUrl: context.apiBaseUrl }),
        onDone: [
          {
            guard: ({ event }) => event.output !== null,
            target: 'authenticated',
            actions: assign(({ event }) => ({
              session: event.output,
            })),
          },
          {
            target: 'unauthenticated.idle',
            actions: assign(() => ({ session: null })),
          },
        ],
        onError: {
          target: 'unauthenticated.failed',
          actions: assign(() => ({ session: null })),
        },
      },
    },
  },
});
