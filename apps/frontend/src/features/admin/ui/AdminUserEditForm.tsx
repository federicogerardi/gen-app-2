import { Button as MuiButton } from '@mui/material';
import type { FieldErrors, UseFormHandleSubmit, UseFormRegister } from 'react-hook-form';

import { appCopy } from '../../../app/copy/system';
import { AdminUserFormFields } from './AdminUserFormFields';
import { type AdminUserFormValues } from '../runtime/admin-user-form';
import type { AdminUsersBusyAction } from '../runtime/useAdminUsersMutations';
import { AdminUserFormShell } from './AdminUserFormShell';

type AdminUserEditFormProps = {
  userId: string;
  busyAction: AdminUsersBusyAction;
  register: UseFormRegister<AdminUserFormValues>;
  errors: FieldErrors<AdminUserFormValues>;
  handleSubmit: UseFormHandleSubmit<AdminUserFormValues>;
  onSubmit: (data: AdminUserFormValues) => void;
  onCancel: () => void;
  headline: string;
  subheadline: string;
  roleDefaultValue: AdminUserFormValues['role'];
  statusDefaultValue: AdminUserFormValues['status'];
};

export const AdminUserEditForm = ({
  userId,
  busyAction,
  register,
  errors,
  handleSubmit,
  onSubmit,
  onCancel,
  headline,
  subheadline,
  roleDefaultValue,
  statusDefaultValue,
}: AdminUserEditFormProps) => {
  return (
    <AdminUserFormShell
      title={headline}
      subtitle={subheadline}
      onSubmit={handleSubmit((data) => void onSubmit(data))}
      actions={(
        <>
          <MuiButton type="submit" variant="contained" disabled={busyAction === `update:${userId}`}>
            {busyAction === `update:${userId}` ? appCopy.ui.adminUsers.editSavingLabel : appCopy.ui.adminUsers.editSubmitLabel}
          </MuiButton>
          <MuiButton
            type="button"
            disabled={busyAction === `update:${userId}`}
            variant="outlined"
            onClick={onCancel}
          >
            {appCopy.ui.actions.cancel}
          </MuiButton>
        </>
      )}
    >
      <AdminUserFormFields
        register={register}
        errors={errors}
        roleDefaultValue={roleDefaultValue}
        statusDefaultValue={statusDefaultValue}
        passwordLabel={appCopy.ui.adminUsers.fieldLabels.passwordNew}
      />
    </AdminUserFormShell>
  );
};