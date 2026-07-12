import { Navigate } from 'react-router-dom';
import { LoginForm } from '../../features/auth/ui/LoginForm';
import { useAuthState, useAuthActions, useOAuthUrl } from '../providers/AuthSessionProvider';
import { ThemeToggleButton } from '../ui/ThemeToggleButton';
import { Shell } from '../ui/primitives';

export const PublicShell = () => {
  const { session, loading, hasError } = useAuthState();
  const { login } = useAuthActions();
  const { oauthStartUrl } = useOAuthUrl();

  if (loading) {
    return <Shell as="main" className="ui-shell-login" />;
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Shell as="main" className="ui-shell-login">
      <div className="ui-shell-login-toggle">
        <ThemeToggleButton />
      </div>
      <LoginForm onSubmit={login} oauthStartUrl={oauthStartUrl} hasExternalError={hasError} />
    </Shell>
  );
};
