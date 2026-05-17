import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { appCopy } from '../../../app/copy/system';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
} from '../../../app/ui/primitives';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { LLMTable, type AdminLlmModelRow } from '../llm/LLMTable';
import { AdminPageContainer } from '../ui/AdminPageContainer';
import { AdminModelCreateForm } from '../ui/AdminModelCreateForm';
import { adminModelFormSchema, type AdminModelFormValues } from '../runtime/admin-models-form';
import { useAdminModelsQuery } from '../../../app/runtime/queries/useAdminModelsQuery';
import { useAdminModelsMutations } from '../runtime/useAdminModelsMutations';

export const AdminModelsPage = () => {
  const auth = useAuthSession();
  const { data: models, loading, error, reload } = useAdminModelsQuery({ apiBaseUrl: auth.apiBaseUrl, capabilities: auth.capabilities });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminModelFormValues>({
    resolver: zodResolver(adminModelFormSchema),
    defaultValues: { key: '', label: '', status: 'enabled' },
  });
  const { busyAction, createModel, setDefaultModel, toggleStatus, deleteModel } = useAdminModelsMutations({
    apiBaseUrl: auth.apiBaseUrl,
    reloadModels: reload,
  });

  return (
    <AdminPageContainer
      title={appCopy.editorial.admin.modelsTitle}
      description="Gestisci il catalogo dei modelli LLM disponibili e lo stato di esposizione nel selector frontend."
    >

      <AdminModelCreateForm
        busyAction={busyAction}
        register={register}
        errors={errors}
        handleSubmit={handleSubmit}
        onSubmit={(data, resetForm) => void createModel(data, resetForm)}
        reset={reset}
      />

      {loading ? <LoadingStateMessage>{appCopy.ui.states.loadingModels}</LoadingStateMessage> : null}
      {error ? <ErrorStateMessage>{error}</ErrorStateMessage> : null}
      {!loading && !error && models.length === 0
        ? <EmptyStateMessage>Nessun modello nel catalogo.</EmptyStateMessage>
        : null}
      {models.length > 0 ? (
          <LLMTable
            models={models}
            busyAction={busyAction}
            onSetDefault={(model) => { void setDefaultModel(model); }}
            onToggleStatus={(model) => { void toggleStatus(model); }}
            onDelete={(model) => { void deleteModel(model); }}
          />
        ) : null}
    </AdminPageContainer>
  );
};
