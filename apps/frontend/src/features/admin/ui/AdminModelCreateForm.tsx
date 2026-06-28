import { Button as MuiButton, MenuItem, TextField } from '@mui/material';
import type { FieldErrors, UseFormHandleSubmit, UseFormRegister, UseFormReset } from 'react-hook-form';

import { appCopy } from '../../../app/copy/system';
import { type AdminModelFormValues } from '../runtime/admin-models-form';
import type { AdminModelsBusyAction } from '../runtime/useAdminModelsMutations';
import { AdminModelFormShell } from './AdminModelFormShell';

type AdminModelCreateFormProps = {
  busyAction: AdminModelsBusyAction;
  register: UseFormRegister<AdminModelFormValues>;
  errors: FieldErrors<AdminModelFormValues>;
  handleSubmit: UseFormHandleSubmit<AdminModelFormValues>;
  onSubmit: (data: AdminModelFormValues, reset: () => void) => void;
  reset: UseFormReset<AdminModelFormValues>;
};

export const AdminModelCreateForm = ({
  busyAction,
  register,
  errors,
  handleSubmit,
  onSubmit,
  reset,
}: AdminModelCreateFormProps) => {
  return (
    <AdminModelFormShell
      title={appCopy.ui.adminModels.createFormTitle}
      subtitle={appCopy.ui.adminModels.createFormSubtitle}
      onSubmit={handleSubmit((data) => void onSubmit(data, () => reset({ key: '', label: '', status: 'enabled' })))}
      actions={(
        <>
          <MuiButton type="submit" variant="contained" disabled={busyAction === 'create'}>
            {busyAction === 'create' ? appCopy.ui.adminModels.createSavingLabel : appCopy.ui.adminModels.createSubmitLabel}
          </MuiButton>
          <MuiButton
            type="button"
            variant="outlined"
            disabled={busyAction === 'create'}
            onClick={() => reset({ key: '', label: '', status: 'enabled' })}
          >
            {appCopy.ui.actions.reset}
          </MuiButton>
        </>
      )}
    >

      <div className="ui-admin-user-form-grid">
        <TextField
          label={appCopy.ui.adminModels.fieldLabels.key}
          {...register('key')}
          placeholder={appCopy.ui.adminModels.fieldLabels.placeholderKey}
          error={!!errors.key}
          helperText={errors.key?.message}
          fullWidth
          required
        />

        <TextField
          label={appCopy.ui.adminModels.fieldLabels.label}
          {...register('label')}
          placeholder={appCopy.ui.adminModels.fieldLabels.placeholderLabel}
          error={!!errors.label}
          helperText={errors.label?.message}
          fullWidth
          required
        />

        <TextField
          select
          label={appCopy.ui.adminModels.fieldLabels.status}
          defaultValue="enabled"
          {...register('status')}
          fullWidth
        >
          <MenuItem value="enabled">{appCopy.ui.statusLabels.enabled}</MenuItem>
          <MenuItem value="disabled">{appCopy.ui.statusLabels.disabled}</MenuItem>
        </TextField>
      </div>

    </AdminModelFormShell>
  );
};