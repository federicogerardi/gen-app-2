import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, MenuItem, Button as MuiButton } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { joinApiPath, requestJson } from '../../../app/runtime/http-client';
import { LLMTable, type AdminLlmModelRow } from '../llm/LLMTable';
import { AdminPageContainer } from '../ui/AdminPageContainer';

type AdminLlmModel = AdminLlmModelRow;

const createModelSchema = z.object({
  key: z.string().min(1, 'Key richiesta'),
  label: z.string().min(1, 'Label richiesta'),
  status: z.enum(['enabled', 'disabled']),
});

type CreateModelFormValues = z.infer<typeof createModelSchema>;

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
  const { publishSuccess, publishError } = useFeedbackMessage();

  const [busyAction, setBusyAction] = useState<'create' | `default:${string}` | `toggle:${string}` | `delete:${string}` | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateModelFormValues>({
    resolver: zodResolver(createModelSchema),
    defaultValues: { key: '', label: '', status: 'enabled' },
  });

  const handleCreateSubmit = async (data: CreateModelFormValues) => {
    setBusyAction('create');

    try {
      await requestJson(joinApiPath(auth.apiBaseUrl, '/api/admin/models'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: data.key.trim(), label: data.label.trim(), status: data.status }),
      });
      reset();
      publishSuccess(appCopy.ui.feedback.adminModelsCreated, { dedupeKey: 'admin-models:create:success' });
      reload();
    } catch {
      publishError(appCopy.ui.feedback.adminModelsCreateFailed, { dedupeKey: 'admin-models:create:error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSetDefault = async (model: AdminLlmModel) => {
    if (model.isDefault) return;
    setBusyAction(`default:${model.id}`);

    try {
      await requestJson(joinApiPath(auth.apiBaseUrl, `/api/admin/models/${model.id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      publishSuccess(appCopy.ui.feedback.adminModelsDefaultUpdated, { dedupeKey: `admin-models:default:${model.id}:success` });
      reload();
    } catch {
      publishError(appCopy.ui.feedback.adminModelsDefaultUpdateFailed, { dedupeKey: `admin-models:default:${model.id}:error` });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleStatus = async (model: AdminLlmModel) => {
    const nextStatus = model.status === 'enabled' ? 'disabled' : 'enabled';
    setBusyAction(`toggle:${model.id}`);

    try {
      await requestJson(joinApiPath(auth.apiBaseUrl, `/api/admin/models/${model.id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      publishSuccess(appCopy.ui.feedback.adminModelsStatusUpdated, { dedupeKey: `admin-models:toggle:${model.id}:success` });
      reload();
    } catch {
      publishError(appCopy.ui.feedback.adminModelsStatusUpdateFailed, { dedupeKey: `admin-models:toggle:${model.id}:error` });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (model: AdminLlmModel) => {
    if (!window.confirm(`Delete model "${model.key}"? This cannot be undone.`)) return;
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
      publishSuccess(appCopy.ui.feedback.adminModelsDeleted, { dedupeKey: `admin-models:delete:${model.id}:success` });
      reload();
    } catch {
      publishError(appCopy.ui.feedback.adminModelsDeleteFailed, { dedupeKey: `admin-models:delete:${model.id}:error` });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <AdminPageContainer
      title={appCopy.editorial.admin.modelsTitle}
      description="Gestisci il catalogo dei modelli LLM disponibili e lo stato di esposizione nel selector frontend."
    >

      <form onSubmit={handleSubmit(handleCreateSubmit)} className="ui-admin-user-form">
        <div className="ui-admin-user-form-headline">
          <h3>Nuovo modello</h3>
          <p className={uiPrimitives.metaLine}>Aggiungi un modello al catalogo.</p>
        </div>

        <div className="ui-admin-user-form-grid">
          <TextField
            label="Key"
            {...register('key')}
            placeholder="es. openrouter/auto"
            error={!!errors.key}
            helperText={errors.key?.message}
            fullWidth
            required
          />

          <TextField
            label="Label"
            {...register('label')}
            placeholder="Nome visualizzato"
            error={!!errors.label}
            helperText={errors.label?.message}
            fullWidth
            required
          />

          <TextField
            select
            label="Status"
            defaultValue="enabled"
            {...register('status')}
            fullWidth
          >
            <MenuItem value="enabled">Enabled</MenuItem>
            <MenuItem value="disabled">Disabled</MenuItem>
          </TextField>
        </div>

        <div className={uiPrimitives.actions}>
          <MuiButton type="submit" variant="contained" disabled={busyAction === 'create'}>
            {busyAction === 'create' ? 'Creazione...' : 'Crea modello'}
          </MuiButton>
          <MuiButton
            type="button"
            variant="outlined"
            disabled={busyAction === 'create'}
            onClick={() => { reset(); }}
          >
            {appCopy.ui.actions.reset}
          </MuiButton>
        </div>
      </form>

      {loading ? <LoadingStateMessage>Caricamento modelli...</LoadingStateMessage> : null}
      {error ? <ErrorStateMessage>{error}</ErrorStateMessage> : null}
      {!loading && !error && models.length === 0
        ? <EmptyStateMessage>Nessun modello nel catalogo.</EmptyStateMessage>
        : null}
      {models.length > 0 ? (
          <LLMTable
            models={models}
            busyAction={busyAction}
            onSetDefault={(model) => { void handleSetDefault(model); }}
            onToggleStatus={(model) => { void handleToggleStatus(model); }}
            onDelete={(model) => { void handleDelete(model); }}
          />
        ) : null}
    </AdminPageContainer>
  );
};
