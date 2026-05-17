import { Button as MuiButton, MenuItem, TextField } from '@mui/material';
import type { FieldErrors, UseFormHandleSubmit, UseFormRegister, UseFormReset } from 'react-hook-form';

import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import { adminModelFormSchema, type AdminModelFormValues } from '../runtime/admin-models-form';
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
      title="Nuovo modello"
      subtitle="Aggiungi un modello al catalogo."
      onSubmit={handleSubmit((data) => void onSubmit(data, () => reset({ key: '', label: '', status: 'enabled' })))}
      actions={(
        <>
          <MuiButton type="submit" variant="contained" disabled={busyAction === 'create'}>
            {busyAction === 'create' ? 'Creazione...' : 'Crea modello'}
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

    </AdminModelFormShell>
  );
};