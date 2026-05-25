import { Button as MuiButton, MenuItem, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { appCopy } from '../../../app/copy/system';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import type { ApiService, ApiServiceBinding } from '../runtime/admin-client';
import {
  ADMIN_API_SERVICE_BINDING_REQUIREDNESS_OPTIONS,
  ADMIN_API_SERVICE_BINDING_STATUS_OPTIONS,
  adminApiServiceBindingFormSchema,
  createEmptyAdminApiServiceBindingForm,
  createEditAdminApiServiceBindingForm,
  type AdminApiServiceBindingFormValues,
} from '../runtime/admin-api-service-binding-form';
import type { AdminApiServiceBindingsBusyAction } from '../runtime/useAdminApiServiceBindingsMutations';

type AdminApiServiceBindingsPanelProps = {
  apiService: ApiService | null;
  bindings: ApiServiceBinding[];
  loading: boolean;
  error: string | null;
  busyAction: AdminApiServiceBindingsBusyAction;
  onSaveBinding: (data: AdminApiServiceBindingFormValues) => Promise<void>;
  onDeleteBinding: (bindingId: string) => Promise<void>;
};

export const AdminApiServiceBindingsPanel = ({
  apiService,
  bindings,
  loading,
  error,
  busyAction,
  onSaveBinding,
  onDeleteBinding,
}: AdminApiServiceBindingsPanelProps) => {
  const [editingBindingId, setEditingBindingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminApiServiceBindingFormValues>({
    resolver: zodResolver(adminApiServiceBindingFormSchema) as any,
    defaultValues: createEmptyAdminApiServiceBindingForm(),
  });

  useEffect(() => {
    setEditingBindingId(null);
    reset(createEmptyAdminApiServiceBindingForm());
  }, [apiService?.id, reset]);

  const startEditingBinding = (binding: ApiServiceBinding) => {
    setEditingBindingId(binding.id);
    reset(createEditAdminApiServiceBindingForm(binding));
  };

  const cancelEditingBinding = () => {
    setEditingBindingId(null);
    reset(createEmptyAdminApiServiceBindingForm());
  };

  return (
    <Surface className="ui-admin-api-service-bindings-panel">
      <div className="ui-admin-api-service-bindings-panel__headline">
        <h3>{appCopy.editorial.admin.apiServiceBindingsTitle}</h3>
        <p className={uiPrimitives.metaLine}>
          {apiService
            ? `${appCopy.ui.adminApiServices.bindings.selectedServicePrefix}${apiService.label}`
            : appCopy.ui.adminApiServices.bindings.noServiceSelected}
        </p>
      </div>

      {apiService ? (
        <form
          className="ui-admin-api-service-bindings-form"
          onSubmit={handleSubmit(async (data) => {
            await onSaveBinding(data);
            cancelEditingBinding();
          })}
        >
          <div className="ui-admin-api-service-form-grid">
            <TextField label={appCopy.ui.adminApiServices.bindings.formLabels.toolKey} {...register('toolKey')} error={!!errors.toolKey} helperText={errors.toolKey?.message} fullWidth required />
            <TextField label={appCopy.ui.adminApiServices.bindings.formLabels.stepKey} {...register('stepKey')} error={!!errors.stepKey} helperText={errors.stepKey?.message} fullWidth required />
            <TextField
              select
              label={appCopy.ui.adminApiServices.bindings.formLabels.bindingStatus}
              defaultValue="active"
              {...register('bindingStatus')}
              fullWidth
            >
              {ADMIN_API_SERVICE_BINDING_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={appCopy.ui.adminApiServices.bindings.formLabels.requiredness}
              defaultValue="required-by-tool-setting"
              {...register('requiredness')}
              fullWidth
            >
              {ADMIN_API_SERVICE_BINDING_REQUIREDNESS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField label={appCopy.ui.adminApiServices.bindings.formLabels.workflowStepType} value="acquisition" disabled fullWidth />
            <input type="hidden" {...register('workflowStepType')} />
            <input type="hidden" {...register('id')} />
          </div>

          <div className={uiPrimitives.actions}>
            <MuiButton type="submit" variant="contained" disabled={busyAction !== null}>
              {editingBindingId ? appCopy.ui.adminApiServices.bindings.updateAction : appCopy.ui.adminApiServices.bindings.createAction}
            </MuiButton>
            <MuiButton type="button" variant="outlined" disabled={busyAction !== null} onClick={cancelEditingBinding}>
              {appCopy.ui.actions.reset}
            </MuiButton>
          </div>
        </form>
      ) : null}

      {loading ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.loadingList}</p> : null}
      {error ? <p className={uiPrimitives.error} role="alert">{error}</p> : null}

      {!loading && !error && apiService ? (
        bindings.length > 0 ? (
          <div className={uiPrimitives.artifactTableWrap}>
            <table className={uiPrimitives.artifactTable}>
              <thead>
                <tr>
                  <th scope="col">{appCopy.ui.adminApiServices.bindings.formLabels.toolKey}</th>
                  <th scope="col">{appCopy.ui.adminApiServices.bindings.formLabels.stepKey}</th>
                  <th scope="col">{appCopy.ui.adminApiServices.bindings.formLabels.bindingStatus}</th>
                  <th scope="col">{appCopy.ui.adminApiServices.bindings.formLabels.requiredness}</th>
                  <th scope="col">{appCopy.ui.adminApiServices.tableHeaders.actions}</th>
                </tr>
              </thead>
              <tbody>
                {bindings.map((binding) => (
                  <tr key={binding.id} className={editingBindingId === binding.id ? uiPrimitives.artifactRowSelected : undefined}>
                    <td><code>{binding.toolKey}</code></td>
                    <td><code>{binding.stepKey}</code></td>
                    <td>{binding.bindingStatus}</td>
                    <td>{binding.requiredness}</td>
                    <td>
                      <div className={uiPrimitives.clusterRow}>
                        <button
                          type="button"
                          className={uiPrimitives.artifactTableActionLink}
                          onClick={() => startEditingBinding(binding)}
                          disabled={busyAction !== null}
                        >
                          {appCopy.ui.actions.edit}
                        </button>
                        <button
                          type="button"
                          className={uiPrimitives.artifactTableActionLink}
                          onClick={() => void onDeleteBinding(binding.id)}
                          disabled={busyAction !== null}
                        >
                          {appCopy.ui.actions.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={uiPrimitives.metaLine}>{appCopy.ui.adminApiServices.bindings.emptyForService}</p>
        )
      ) : null}
    </Surface>
  );
};
