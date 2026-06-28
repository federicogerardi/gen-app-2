import { Button as MuiButton } from '@mui/material';
import type { FieldErrors, UseFormHandleSubmit, UseFormRegister, UseFormReset } from 'react-hook-form';

import { appCopy } from '../../../app/copy/system';
import { AdminUserFormFields } from './AdminUserFormFields';
import { createEmptyUserForm, type AdminUserFormValues } from '../runtime/admin-user-form';
import type { AdminUsersBusyAction } from '../runtime/useAdminUsersMutations';
import { AdminUserFormShell } from './AdminUserFormShell';

type AdminUserCreateFormProps = {
  busyAction: AdminUsersBusyAction;
  register: UseFormRegister<AdminUserFormValues>;
  errors: FieldErrors<AdminUserFormValues>;
  handleSubmit: UseFormHandleSubmit<AdminUserFormValues>;
  onSubmit: (data: AdminUserFormValues) => void;
  reset: UseFormReset<AdminUserFormValues>;
};

export const AdminUserCreateForm = ({
  busyAction,
  register,
  errors,
  handleSubmit,
  onSubmit,
  reset,
}: AdminUserCreateFormProps) => {
  return (
    <AdminUserFormShell
      title={appCopy.ui.adminUsers.createFormTitle}
      subtitle={appCopy.ui.adminUsers.createFormSubtitle}
      useSurface
      onSubmit={handleSubmit((data) => void onSubmit(data))}
      actions={(
        <>
          <MuiButton type="submit" variant="contained" disabled={busyAction === 'create'}>
            {busyAction === 'create' ? appCopy.ui.adminUsers.createSavingLabel : appCopy.ui.adminUsers.createSubmitLabel}
          </MuiButton>
          <MuiButton
            type="button"
            onClick={() => reset(createEmptyUserForm())}
            disabled={busyAction === 'create'}
            variant="outlined"
          >
            {appCopy.ui.actions.reset}
          </MuiButton>
        </>
      )}
    >
      <AdminUserFormFields
        register={register}
        errors={errors}
        roleDefaultValue="member"
        statusDefaultValue="active"
        passwordLabel={appCopy.ui.adminUsers.fieldLabels.passwordInitial}
      />
    </AdminUserFormShell>
  );
};