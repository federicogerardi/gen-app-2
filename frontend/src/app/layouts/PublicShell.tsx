import { Navigate } from 'react-router-dom';
import { appCopy } from '../copy/system';
import { LoginForm } from '../../features/auth/ui/LoginForm';
import { useAuthSession } from '../providers/AuthSessionProvider';
import { Shell, Surface, uiPrimitives } from '../ui/primitives';

export const PublicShell = () => {
  const auth = useAuthSession();

  if (auth.loading) {
    return <Shell as="main"><p>{appCopy.ui.session.verifying}</p></Shell>;
  }

  if (auth.session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Shell as="main">
      {auth.error ? <p className={uiPrimitives.error}>{auth.error}</p> : null}
      <Surface as="section" className={uiPrimitives.stack}>
        <p className={uiPrimitives.metaLine}>{appCopy.editorial.publicShell.eyebrow}</p>
        <h1>{appCopy.editorial.publicShell.headline}</h1>
        <p>{appCopy.editorial.publicShell.body}</p>
      </Surface>
      <LoginForm onSubmit={auth.login} oauthStartUrl={auth.oauthStartUrl} />
    </Shell>
  );
};
