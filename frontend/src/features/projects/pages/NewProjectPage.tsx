import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Button, Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { createProject } from '../runtime/projects-client';

export const NewProjectPage = () => {
  const auth = useAuthSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const created = await createProject(
        { name, description },
        {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        },
      );
      setError(null);
      navigate(`/dashboard/projects/${created.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create project');
    }
  };

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>Nuovo progetto</h2>
        <Link to="/dashboard/projects" className={uiPrimitives.inlineLink}>Torna alla lista</Link>
      </TopBar>

      <form className={uiPrimitives.grid} onSubmit={handleSubmit}>
        <label>
          Nome progetto
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <label>
          Descrizione
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} />
        </label>

        {error ? <p className={uiPrimitives.error}>{error}</p> : null}

        <Button type="submit">Crea progetto</Button>
      </form>
    </Surface>
  );
};
