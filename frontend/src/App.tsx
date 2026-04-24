import { useEffect, useMemo, useState } from 'react';
import { useMachine } from '@xstate/react';
import {
  frontendStreamMachine,
  type FrontendStreamStatus,
} from './features/generation/machines/frontend-stream.machine';
import { GenerationForm } from './features/generation/ui/GenerationForm';
import { GenerationStreamPanel } from './features/generation/ui/GenerationStreamPanel';
import {
  googleOAuthStartUrl,
  loginWithPassword,
  logoutSession,
  readSession,
  type AuthSession,
} from './features/auth/runtime/auth-client';
import { LoginForm } from './features/auth/ui/LoginForm';

// Stringa vuota = path relativi → il proxy Vite (o il reverse proxy in prod) gestisce il routing.
// Sovrascrivi con VITE_API_BASE_URL solo se il frontend e il backend sono su origin diverse.
const DEFAULT_API_BASE = '';

const getStreamStatus = (
  snapshot: ReturnType<typeof frontendStreamMachine.transition>,
): FrontendStreamStatus => {
  if (snapshot.matches('idle')) {
    return 'idle';
  }

  if (snapshot.matches({ active: 'connecting' })) {
    return 'connecting';
  }

  if (snapshot.matches({ active: 'streaming' })) {
    return 'streaming';
  }

  if (snapshot.matches({ active: 'reconnecting' })) {
    return 'reconnecting';
  }

  if (snapshot.matches('completed')) {
    return 'completed';
  }

  return 'failed';
};

export const App = () => {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_API_BASE;

  const [session, setSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [snapshot, send] = useMachine(frontendStreamMachine, {
    input: {
      apiBaseUrl,
      maxReconnectAttempts: 3,
      reconnectBaseDelayMs: 500,
      reconnectMaxDelayMs: 4000,
    },
  });

  const streamStatus = getStreamStatus(snapshot);
  const isStreamActive = snapshot.matches('active');

  useEffect(() => {
    void (async () => {
      try {
        const nextSession = await readSession({ apiBaseUrl });
        setSession(nextSession);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Session bootstrap failed');
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [apiBaseUrl]);

  const oauthUrl = useMemo(() => googleOAuthStartUrl(apiBaseUrl), [apiBaseUrl]);

  const handleLogin = async (email: string, password: string): Promise<void> => {
    const next = await loginWithPassword(email, password, { apiBaseUrl });
    setSession(next);
    setAuthError(null);
  };

  const handleLogout = async (): Promise<void> => {
    await logoutSession({ apiBaseUrl });
    setSession(null);
    send({ type: 'RESET' });
  };

  if (authLoading) {
    return <main className="app-shell"><p>Verifica sessione...</p></main>;
  }

  if (!session) {
    return (
      <main className="app-shell">
        {authError ? <p className="error-message">{authError}</p> : null}
        <LoginForm onSubmit={handleLogin} oauthStartUrl={oauthUrl} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar panel">
        <div>
          <h1>Generation Console</h1>
          <p>{session.user.email} ({session.user.role})</p>
        </div>
        <button type="button" onClick={() => void handleLogout()}>
          Logout
        </button>
      </header>

      <section className="layout-grid">
        <GenerationForm
          userId={session.user.id}
          disabled={isStreamActive}
          onStart={(request) => send({ type: 'REQUEST_START', request })}
        />

        <GenerationStreamPanel
          status={streamStatus}
          content={snapshot.context.content}
          requestId={snapshot.context.requestId}
          artifactId={snapshot.context.artifactId}
          reconnectAttempts={snapshot.context.reconnectAttempts}
          errorCode={snapshot.context.errorCode}
          errorMessage={snapshot.context.errorMessage}
          onRetry={() => send({ type: 'RETRY' })}
          onCancel={() => send({ type: 'CANCEL' })}
          onReset={() => send({ type: 'RESET' })}
          canRetry={snapshot.matches('failed')}
          canCancel={isStreamActive}
        />
      </section>
    </main>
  );
};
