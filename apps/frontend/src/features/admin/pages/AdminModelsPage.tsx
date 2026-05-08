import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { appCopy } from '../../../app/copy/system';
import {
  Button,
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { joinApiPath, requestJson } from '../../../app/runtime/http-client';

type AdminLlmModel = {
  id: string;
  key: string;
  label: string;
  status: 'enabled' | 'disabled';
  isDefault: boolean;
  sortOrder: number | null;
};

type CreateFormState = {
  key: string;
  label: string;
  status: 'enabled' | 'disabled';
};

const createEmptyForm = (): CreateFormState => ({ key: '', label: '', status: 'enabled' });

const useAdminModelsQuery = (apiBaseUrl: string) => {
  const [data, setData] = useState<AdminLlmModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await requestJson<{ data?: { models?: AdminLlmModel[] } }>(
          joinApiPath(apiBaseUrl, '/api/admin/models'),
          { method: 'GET', credentials: 'include' },
        );
        if (!cancelled) {
          setData(res.data?.models ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setData([]);
          setError(err instanceof Error ? err.message : 'Failed to load models');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [apiBaseUrl, reloadToken]);

  return { data, loading, error, reload };
};

export const AdminModelsPage = () => {
  const auth = useAuthSession();
  const { data: models, loading, error, reload } = useAdminModelsQuery(auth.apiBaseUrl);

  const [form, setForm] = useState<CreateFormState>(createEmptyForm);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'create' | `default:${string}` | `toggle:${string}` | `delete:${string}` | null>(null);

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutationError(null);
    setBusyAction('create');

    try {
      await requestJson(joinApiPath(auth.apiBaseUrl, '/api/admin/models'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: form.key.trim(), label: form.label.trim(), status: form.status }),
      });
      setForm(createEmptyForm());
      reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to create model');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSetDefault = async (model: AdminLlmModel) => {
    if (model.isDefault) return;
    setMutationError(null);
    setBusyAction(`default:${model.id}`);

    try {
      await requestJson(joinApiPath(auth.apiBaseUrl, `/api/admin/models/${model.id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to set default');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleStatus = async (model: AdminLlmModel) => {
    const nextStatus = model.status === 'enabled' ? 'disabled' : 'enabled';
    setMutationError(null);
    setBusyAction(`toggle:${model.id}`);

    try {
      await requestJson(joinApiPath(auth.apiBaseUrl, `/api/admin/models/${model.id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (model: AdminLlmModel) => {
    if (!window.confirm(`Delete model "${model.key}"? This cannot be undone.`)) return;
    setMutationError(null);
    setBusyAction(`delete:${model.id}`);

    try {
      const res = await fetch(joinApiPath(auth.apiBaseUrl, `/api/admin/models/${model.id}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to delete model');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.admin.modelsTitle}</h2>
        <p className={uiPrimitives.metaLine}>Gestisci il catalogo dei modelli LLM disponibili.</p>
      </TopBar>

      <Surface as="form" onSubmit={handleCreateSubmit} className="ui-admin-user-form">
        <div className="ui-admin-user-form-headline">
          <h3>Nuovo modello</h3>
          <p className={uiPrimitives.metaLine}>Aggiungi un modello al catalogo.</p>
        </div>

        <div className="ui-admin-user-form-grid">
          <label>
            Key
            <input
              name="key"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="es. openrouter/auto"
              required
            />
          </label>

          <label>
            Label
            <input
              name="label"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Nome visualizzato"
              required
            />
          </label>

          <label>
            Status
            <select
              name="status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'enabled' | 'disabled' }))}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>

        <div className={uiPrimitives.actions}>
          <Button type="submit" disabled={busyAction === 'create'}>
            {busyAction === 'create' ? 'Creazione...' : 'Crea modello'}
          </Button>
          <Button
            type="button"
            disabled={busyAction === 'create'}
            onClick={() => { setForm(createEmptyForm()); setMutationError(null); }}
          >
            {appCopy.ui.actions.reset}
          </Button>
        </div>
      </Surface>

      {loading ? <LoadingStateMessage>Caricamento modelli...</LoadingStateMessage> : null}
      {error ? <ErrorStateMessage>{error}</ErrorStateMessage> : null}
      {mutationError ? <ErrorStateMessage>{mutationError}</ErrorStateMessage> : null}
      {!loading && !error && models.length === 0
        ? <EmptyStateMessage>Nessun modello nel catalogo.</EmptyStateMessage>
        : null}

      {models.length > 0 ? (
        <div className={uiPrimitives.artifactTableWrap}>
          <table className={uiPrimitives.artifactTable}>
            <thead>
              <tr>
                <th>Key</th>
                <th>Label</th>
                <th>Status</th>
                <th>Default</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id}>
                  <td><code>{model.key}</code></td>
                  <td>{model.label}</td>
                  <td>
                    <span className={uiPrimitives.metaLine}>
                      {model.status === 'enabled' ? '✓ enabled' : '✗ disabled'}
                    </span>
                  </td>
                  <td>{model.isDefault ? '★' : null}</td>
                  <td>
                    <div className={uiPrimitives.actions}>
                      {!model.isDefault ? (
                        <Button
                          type="button"
                          disabled={busyAction === `default:${model.id}`}
                          onClick={() => void handleSetDefault(model)}
                        >
                          {busyAction === `default:${model.id}` ? '...' : 'Set default'}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        disabled={busyAction === `toggle:${model.id}`}
                        onClick={() => void handleToggleStatus(model)}
                      >
                        {busyAction === `toggle:${model.id}`
                          ? '...'
                          : model.status === 'enabled' ? 'Disabilita' : 'Abilita'}
                      </Button>
                      <Button
                        type="button"
                        disabled={busyAction === `delete:${model.id}` || model.isDefault}
                        onClick={() => void handleDelete(model)}
                      >
                        {busyAction === `delete:${model.id}` ? 'Eliminazione...' : 'Elimina'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Surface>
  );
};
