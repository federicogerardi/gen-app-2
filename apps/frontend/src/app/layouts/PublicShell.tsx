import { Navigate } from 'react-router-dom';
import { LoginForm } from '../../features/auth/ui/LoginForm';
import { useAuthSession } from '../providers/AuthSessionProvider';
import { ThemeToggleButton } from '../ui/ThemeToggleButton';
import { Shell } from '../ui/primitives';

export const PublicShell = () => {
  const auth = useAuthSession();

  if (auth.loading) {
    return <Shell as="main" className="ui-shell-login" />;
  }

  if (auth.session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Shell as="main" className="ui-shell-login">
      <div className="ui-shell-login-toggle">
        <ThemeToggleButton />
      </div>
      <LoginForm onSubmit={auth.login} oauthStartUrl={auth.oauthStartUrl} hasExternalError={auth.hasError} />
    </Shell>
  );
};
