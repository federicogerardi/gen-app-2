import { useState, type FormEvent } from 'react';

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
      setError(submissionError instanceof Error ? submissionError.message : 'Login failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="panel login-panel">
      <h1>Accesso</h1>
      <form className="grid" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="error-message">{error}</p> : null}

        <button type="submit" disabled={pending}>
          {pending ? 'Accesso in corso...' : 'Login'}
        </button>
      </form>

      <a className="oauth-link" href={oauthStartUrl}>
        Continua con Google
      </a>
    </section>
  );
};
