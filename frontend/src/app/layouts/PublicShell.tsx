import { Navigate } from 'react-router-dom';
import { LoginForm } from '../../features/auth/ui/LoginForm';
import { useAuthSession } from '../providers/AuthSessionProvider';

export const PublicShell = () => {
  const auth = useAuthSession();

  if (auth.loading) {
    return <main className="app-shell"><p>Verifica sessione...</p></main>;
  }

  if (auth.session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="app-shell">
      {auth.error ? <p className="error-message">{auth.error}</p> : null}
      <LoginForm onSubmit={auth.login} oauthStartUrl={auth.oauthStartUrl} />
    </main>
  );
};
