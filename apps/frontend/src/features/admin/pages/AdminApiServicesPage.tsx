import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
} from '../../../app/ui/primitives';
import { AdminPageContainer } from '../ui/AdminPageContainer';
import { AdminApiServiceBindingsPanel } from '../ui/AdminApiServiceBindingsPanel';
import { AdminApiServiceCreateForm } from '../ui/AdminApiServiceCreateForm';
import { AdminApiServicesTable } from '../ui/AdminApiServicesTable';
import { AdminApiServicesToolbar } from '../ui/AdminApiServicesToolbar';
import { useAdminApiServicesQuery } from '../runtime/useAdminApiServicesQuery';
import { useAdminApiServicesMutations } from '../runtime/useAdminApiServicesMutations';
import { useAdminApiServiceBindingsQuery } from '../runtime/useAdminApiServiceBindingsQuery';
import { useAdminApiServiceBindingsMutations } from '../runtime/useAdminApiServiceBindingsMutations';
import type { ApiService, CreateAdminApiServiceInput, UpdateAdminApiServiceInput, UpsertAdminApiServiceBindingInput } from '../runtime/admin-client';
import {
  adminApiServiceFormSchema,
  createEmptyAdminApiServiceForm,
  createEditAdminApiServiceForm,
  parseJsonArray,
  parseJsonRecord,
  parseOptionalTokenHeaderName,
  parseTimeoutMs,
  parseRetryCount,
  parsePositiveInteger,
  type AdminApiServiceFormValues,
} from '../runtime/admin-api-service-form';

const toCreateInput = (values: AdminApiServiceFormValues): CreateAdminApiServiceInput => {
  const timeoutMs = parseTimeoutMs(values.timeoutMs);
  const retryCount = parseRetryCount(values.retryCount);
  const contractProfileVersion = parsePositiveInteger(values.contractProfileVersion);

  return {
    key: values.key.trim(),
    label: values.label.trim(),
    baseUrl: values.baseUrl.trim(),
    resourcePath: values.resourcePath.trim(),
    accessMode: values.accessMode,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(retryCount !== undefined ? { retryCount } : {}),
    requestMethod: values.requestMethod,
    tokenHeaderName: parseOptionalTokenHeaderName(values.tokenHeaderName),
    requestTemplateJson: parseJsonRecord(values.requestTemplateJson, {}),
    requestMappingRulesJson: parseJsonArray(values.requestMappingRulesJson),
    requestHeadersTemplateJson: parseJsonRecord(values.requestHeadersTemplateJson, {}),
    responseMappingRulesJson: parseJsonArray(values.responseMappingRulesJson),
    errorMappingRulesJson: parseJsonArray(values.errorMappingRulesJson),
    ...(contractProfileVersion !== undefined ? { contractProfileVersion } : {}),
    status: values.status,
  };
};

const toUpdateInput = (values: AdminApiServiceFormValues): UpdateAdminApiServiceInput => {
  const timeoutMs = parseTimeoutMs(values.timeoutMs);
  const retryCount = parseRetryCount(values.retryCount);
  const contractProfileVersion = parsePositiveInteger(values.contractProfileVersion);

  return {
    key: values.key.trim(),
    label: values.label.trim(),
    baseUrl: values.baseUrl.trim(),
    resourcePath: values.resourcePath.trim(),
    accessMode: values.accessMode,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(retryCount !== undefined ? { retryCount } : {}),
    requestMethod: values.requestMethod,
    tokenHeaderName: parseOptionalTokenHeaderName(values.tokenHeaderName),
    requestTemplateJson: parseJsonRecord(values.requestTemplateJson, {}),
    requestMappingRulesJson: parseJsonArray(values.requestMappingRulesJson),
    requestHeadersTemplateJson: parseJsonRecord(values.requestHeadersTemplateJson, {}),
    responseMappingRulesJson: parseJsonArray(values.responseMappingRulesJson),
    errorMappingRulesJson: parseJsonArray(values.errorMappingRulesJson),
    ...(contractProfileVersion !== undefined ? { contractProfileVersion } : {}),
    status: values.status,
  };
};

const toBindingInput = (values: import('../runtime/admin-api-service-binding-form').AdminApiServiceBindingFormValues): UpsertAdminApiServiceBindingInput => ({
  ...(values.id ? { id: values.id } : {}),
  toolKey: values.toolKey.trim(),
  stepKey: values.stepKey.trim(),
  workflowStepType: 'acquisition',
  bindingStatus: values.bindingStatus,
  requiredness: values.requiredness,
});

export const AdminApiServicesPage = () => {
  const auth = useAuthSession();
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [editingApiServiceId, setEditingApiServiceId] = useState<string | null>(null);
  const [selectedApiServiceId, setSelectedApiServiceId] = useState<string | null>(null);

  const apiServicesQuery = useAdminApiServicesQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });

  const editingApiService = apiServicesQuery.data.find((service) => service.id === editingApiServiceId) ?? null;
  const selectedApiService = apiServicesQuery.data.find((service) => service.id === selectedApiServiceId) ?? null;

  const createForm = useForm<AdminApiServiceFormValues>({
    resolver: zodResolver(adminApiServiceFormSchema) as any,
    defaultValues: createEmptyAdminApiServiceForm(),
  });

  const editForm = useForm<AdminApiServiceFormValues>({
    resolver: zodResolver(adminApiServiceFormSchema) as any,
    defaultValues: createEmptyAdminApiServiceForm(),
  });

  useEffect(() => {
    if (!editingApiService) {
      editForm.reset(createEmptyAdminApiServiceForm());
      return;
    }

    editForm.reset(createEditAdminApiServiceForm(editingApiService));
  }, [editingApiService, editForm]);

  const closeEditForm = () => {
    setEditingApiServiceId(null);
    editForm.reset(createEmptyAdminApiServiceForm());
  };

  const { busyAction, createApiService, updateApiService, deleteApiService } = useAdminApiServicesMutations({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    reloadApiServices: apiServicesQuery.reload,
    onCreateReset: () => createForm.reset(createEmptyAdminApiServiceForm()),
    onEditClosed: closeEditForm,
  });

  const bindingsQuery = useAdminApiServiceBindingsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    apiServiceId: selectedApiServiceId,
  });

  const { busyAction: bindingBusyAction, saveBinding, removeBinding } = useAdminApiServiceBindingsMutations({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    apiServiceId: selectedApiServiceId,
    reloadBindings: bindingsQuery.reload,
    onBindingSelected: () => undefined,
  });

  const handleStartEdit = (apiService: ApiService) => {
    setEditingApiServiceId(apiService.id);
    editForm.reset(createEditAdminApiServiceForm(apiService));
  };

  const handleSelectBindings = (apiService: ApiService) => {
    setSelectedApiServiceId(apiService.id);
  };

  return (
    <AdminPageContainer
      title={appCopy.editorial.admin.apiServicesTitle}
      description={appCopy.editorial.admin.apiServicesBody}
    >
      <AdminApiServicesToolbar
        showCreateForm={showCreateForm}
        busyAction={busyAction}
        loading={apiServicesQuery.loading}
        onToggleCreateForm={() => setShowCreateForm((current) => !current)}
        onReload={apiServicesQuery.reload}
      />

      {showCreateForm ? (
        <AdminApiServiceCreateForm
          title={appCopy.ui.adminApiServices.createFormTitle}
          subtitle={appCopy.ui.adminApiServices.createFormSubtitle}
          submitLabel={appCopy.ui.adminApiServices.createSubmitLabel}
          busyAction={busyAction}
          register={createForm.register}
          errors={createForm.formState.errors}
          handleSubmit={createForm.handleSubmit}
          onSubmit={async (values) => { await createApiService(toCreateInput(values)); }}
          onCancel={() => createForm.reset(createEmptyAdminApiServiceForm())}
        />
      ) : null}

      {editingApiService ? (
        <AdminApiServiceCreateForm
          title={appCopy.ui.adminApiServices.editFormTitle}
          subtitle={`${appCopy.ui.adminApiServices.editFormSubtitlePrefix}${editingApiService.label}.`}
          submitLabel={appCopy.ui.adminApiServices.editSubmitLabel}
          busyAction={busyAction}
          register={editForm.register}
          errors={editForm.formState.errors}
          handleSubmit={editForm.handleSubmit}
          onSubmit={async (values) => { await updateApiService(editingApiService.id, toUpdateInput(values)); }}
          onCancel={closeEditForm}
        />
      ) : null}

      {apiServicesQuery.loading ? <LoadingStateMessage>{appCopy.ui.states.loadingList}</LoadingStateMessage> : null}
      {apiServicesQuery.error ? <ErrorStateMessage>{apiServicesQuery.error}</ErrorStateMessage> : null}

      {!apiServicesQuery.loading && !apiServicesQuery.error && apiServicesQuery.data.length === 0 ? (
        <EmptyStateMessage>{appCopy.ui.adminApiServices.emptyApiServices}</EmptyStateMessage>
      ) : null}

      {apiServicesQuery.data.length > 0 ? (
        <AdminApiServicesTable
          apiServices={apiServicesQuery.data}
          selectedApiServiceId={selectedApiServiceId}
          editingApiServiceId={editingApiServiceId}
          busyAction={busyAction}
          onStartEdit={handleStartEdit}
          onDelete={(apiServiceId) => void deleteApiService(apiServiceId)}
          onSelectBindings={handleSelectBindings}
        />
      ) : null}

      <AdminApiServiceBindingsPanel
        apiService={selectedApiService}
        bindings={bindingsQuery.data}
        loading={bindingsQuery.loading}
        error={bindingsQuery.error}
        busyAction={bindingBusyAction}
        onSaveBinding={async (values) => { await saveBinding(toBindingInput(values)); }}
        onDeleteBinding={async (bindingId) => { await removeBinding(bindingId); }}
      />
    </AdminPageContainer>
  );
};
