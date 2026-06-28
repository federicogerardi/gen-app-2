import { MenuItem, TextField } from '@mui/material';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { appCopy } from '../../../app/copy/system';
import {
  ADMIN_USER_ROLE_OPTIONS,
  ADMIN_USER_STATUS_OPTIONS,
  type AdminUserFormValues,
} from '../runtime/admin-user-form';

type AdminUserFormFieldsProps = {
  register: UseFormRegister<AdminUserFormValues>;
  errors: FieldErrors<AdminUserFormValues>;
  roleDefaultValue: AdminUserFormValues['role'];
  statusDefaultValue: AdminUserFormValues['status'];
  passwordLabel: string;
};

export const AdminUserFormFields = ({
  register,
  errors,
  roleDefaultValue,
  statusDefaultValue,
  passwordLabel,
}: AdminUserFormFieldsProps) => {
  return (
    <>
      <div className="ui-admin-user-form-grid">
        <TextField
          label={appCopy.ui.labels.email}
          type="email"
          {...register('email')}
          error={!!errors.email}
          helperText={errors.email?.message}
          fullWidth
          required
        />

        <TextField
          select
          label={appCopy.ui.adminUsers.fieldLabels.role}
          defaultValue={roleDefaultValue}
          {...register('role')}
          error={!!errors.role}
          helperText={errors.role?.message}
          fullWidth
        >
          {ADMIN_USER_ROLE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label={appCopy.ui.adminUsers.fieldLabels.status}
          defaultValue={statusDefaultValue}
          {...register('status')}
          error={!!errors.status}
          helperText={errors.status?.message}
          fullWidth
        >
          {ADMIN_USER_STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          label={appCopy.ui.adminUsers.fieldLabels.monthlyQuota}
          type="number"
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          {...register('monthlyQuota')}
          error={!!errors.monthlyQuota}
          helperText={errors.monthlyQuota?.message}
          fullWidth
        />

        <TextField
          label={appCopy.ui.adminUsers.fieldLabels.monthlyArtifactLimit}
          type="number"
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          {...register('monthlyArtifactLimit')}
          error={!!errors.monthlyArtifactLimit}
          helperText={errors.monthlyArtifactLimit?.message}
          fullWidth
        />
      </div>

      <TextField
        label={passwordLabel}
        type="password"
        {...register('password')}
        error={!!errors.password}
        helperText={errors.password?.message}
        fullWidth
      />
    </>
  );
};