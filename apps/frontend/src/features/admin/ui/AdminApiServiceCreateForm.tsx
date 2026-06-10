import { Button as MuiButton, MenuItem, TextField } from '@mui/material';
import type { FieldErrors, UseFormHandleSubmit, UseFormRegister } from 'react-hook-form';

import { appCopy } from '../../../app/copy/system';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import {
  ADMIN_API_SERVICE_ACCESS_MODE_OPTIONS,
  ADMIN_API_SERVICE_REQUEST_METHOD_OPTIONS,
  ADMIN_API_SERVICE_STATUS_OPTIONS,
  type AdminApiServiceFormValues,
} from '../runtime/admin-api-service-form';

type AdminApiServiceCreateFormProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  busyAction: string | null;
  register: UseFormRegister<AdminApiServiceFormValues>;
  errors: FieldErrors<AdminApiServiceFormValues>;
  handleSubmit: UseFormHandleSubmit<AdminApiServiceFormValues>;
  onSubmit: (data: AdminApiServiceFormValues) => Promise<void>;
  onCancel: () => void;
};

export const AdminApiServiceCreateForm = ({
  title,
  subtitle,
  submitLabel,
  busyAction,
  register,
  errors,
  handleSubmit,
  onSubmit,
  onCancel,
}: AdminApiServiceCreateFormProps) => {
  return (
    <Surface as="form" className="ui-admin-api-service-form" onSubmit={handleSubmit((data) => void onSubmit(data))}>
      <div className="ui-admin-api-service-form-headline">
        <h3>{title}</h3>
        <p className={uiPrimitives.metaLine}>{subtitle}</p>
      </div>

      <div className="ui-admin-api-service-form-grid">
        <TextField label={appCopy.ui.adminApiServices.fieldLabels.key} {...register('key')} error={!!errors.key} helperText={errors.key?.message} fullWidth required />
        <TextField label={appCopy.ui.adminApiServices.fieldLabels.label} {...register('label')} error={!!errors.label} helperText={errors.label?.message} fullWidth required />
        <TextField label={appCopy.ui.adminApiServices.fieldLabels.baseUrl} {...register('baseUrl')} error={!!errors.baseUrl} helperText={errors.baseUrl?.message} fullWidth required />
        <TextField label={appCopy.ui.adminApiServices.fieldLabels.resourcePath} {...register('resourcePath')} error={!!errors.resourcePath} helperText={errors.resourcePath?.message} fullWidth required />
        <TextField select label={appCopy.ui.adminApiServices.fieldLabels.accessMode} defaultValue="public" {...register('accessMode')} fullWidth>
          {ADMIN_API_SERVICE_ACCESS_MODE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
        <TextField select label={appCopy.ui.adminApiServices.fieldLabels.requestMethod} defaultValue="GET" {...register('requestMethod')} fullWidth>
          {ADMIN_API_SERVICE_REQUEST_METHOD_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          label={appCopy.ui.adminApiServices.fieldLabels.tokenHeaderName}
          {...register('tokenHeaderName')}
          error={!!errors.tokenHeaderName}
          helperText={errors.tokenHeaderName?.message ?? appCopy.ui.adminApiServices.tokenHeaderNameHelper}
          fullWidth
        />
        <TextField label={appCopy.ui.adminApiServices.fieldLabels.timeoutMs} type="number" {...register('timeoutMs')} error={!!errors.timeoutMs} helperText={errors.timeoutMs?.message} fullWidth />
        <TextField label={appCopy.ui.adminApiServices.fieldLabels.retryCount} type="number" {...register('retryCount')} error={!!errors.retryCount} helperText={errors.retryCount?.message} fullWidth />
        <TextField label={appCopy.ui.adminApiServices.fieldLabels.contractProfileVersion} type="number" {...register('contractProfileVersion')} error={!!errors.contractProfileVersion} helperText={errors.contractProfileVersion?.message} fullWidth />
        <TextField select label={appCopy.ui.adminApiServices.fieldLabels.status} defaultValue="active" {...register('status')} fullWidth>
          {ADMIN_API_SERVICE_STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
      </div>

      <details className="ui-admin-api-service-form-advanced">
        <summary>{appCopy.ui.adminApiServices.advancedJsonSummary}</summary>
        <p className={uiPrimitives.metaLine}>{appCopy.ui.adminApiServices.advancedJsonHelper}</p>
        <div className="ui-admin-api-service-form-grid ui-admin-api-service-form-grid--json">
          <TextField
            label={appCopy.ui.adminApiServices.fieldLabels.requestTemplateJson}
            {...register('requestTemplateJson')}
            error={!!errors.requestTemplateJson}
            helperText={errors.requestTemplateJson?.message}
            fullWidth
            multiline
            minRows={3}
          />
          <TextField
            label={appCopy.ui.adminApiServices.fieldLabels.requestMappingRulesJson}
            {...register('requestMappingRulesJson')}
            error={!!errors.requestMappingRulesJson}
            helperText={errors.requestMappingRulesJson?.message}
            fullWidth
            multiline
            minRows={3}
          />
          <TextField
            label={appCopy.ui.adminApiServices.fieldLabels.requestHeadersTemplateJson}
            {...register('requestHeadersTemplateJson')}
            error={!!errors.requestHeadersTemplateJson}
            helperText={errors.requestHeadersTemplateJson?.message}
            fullWidth
            multiline
            minRows={3}
          />
          <TextField
            label={appCopy.ui.adminApiServices.fieldLabels.responseMappingRulesJson}
            {...register('responseMappingRulesJson')}
            error={!!errors.responseMappingRulesJson}
            helperText={errors.responseMappingRulesJson?.message}
            fullWidth
            multiline
            minRows={3}
          />
          <TextField
            label={appCopy.ui.adminApiServices.fieldLabels.errorMappingRulesJson}
            {...register('errorMappingRulesJson')}
            error={!!errors.errorMappingRulesJson}
            helperText={errors.errorMappingRulesJson?.message}
            fullWidth
            multiline
            minRows={3}
          />
        </div>
      </details>

      <div className={uiPrimitives.actions}>
        <MuiButton type="submit" variant="contained" disabled={busyAction !== null}>
          {busyAction === 'create' ? appCopy.ui.adminApiServices.createSavingLabel : submitLabel}
        </MuiButton>
        <MuiButton type="button" variant="outlined" disabled={busyAction !== null} onClick={() => onCancel()}>
          {appCopy.ui.actions.reset}
        </MuiButton>
      </div>
    </Surface>
  );
};
