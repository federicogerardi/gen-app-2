import { useState, type FormEvent } from 'react';
import { appCopy } from '../../../app/copy/system';
import { Button, Surface, uiPrimitives } from '../../../app/ui/primitives';

type LoginFormProps = {
  onSubmit: (email: string, password: string) => Promise<void>;
  oauthStartUrl: string;
};

export const LoginForm = ({ onSubmit, oauthStartUrl }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await onSubmit(email, password);
      setPassword('');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : appCopy.ui.fallbackErrors.loginFailed);
    } finally {
      setPending(false);
    }
  };

  return (
    <Surface as="section" className={uiPrimitives.loginPanel}>
      <p className={uiPrimitives.metaLine}>{appCopy.editorial.auth.eyebrow}</p>
      <h1>{appCopy.editorial.auth.headline}</h1>
      <p>{appCopy.editorial.auth.body}</p>
      <form className={uiPrimitives.grid} onSubmit={handleSubmit}>
        <label>
          {appCopy.ui.labels.email}
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          {appCopy.ui.labels.password}
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className={uiPrimitives.error}>{error}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? appCopy.editorial.auth.pendingAccess : appCopy.ui.actions.enterWorkspace}
        </Button>
      </form>

      <a className={uiPrimitives.oauthLink} href={oauthStartUrl}>
        {appCopy.ui.actions.continueWithGoogleWorkspace}
      </a>
    </Surface>
  );
};
