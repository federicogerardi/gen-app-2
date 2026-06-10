import { z } from 'zod';

import type { ApiServiceBinding, ApiServiceBindingRequiredness, ApiServiceBindingStatus } from './admin-client';

export const ADMIN_API_SERVICE_BINDING_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const satisfies ReadonlyArray<{ value: ApiServiceBindingStatus; label: string }>;

export const ADMIN_API_SERVICE_BINDING_REQUIREDNESS_OPTIONS = [
  { value: 'always-required', label: 'Always required' },
  { value: 'required-by-tool-setting', label: 'Required by tool setting' },
  { value: 'optional-by-tool-setting', label: 'Optional by tool setting' },
] as const satisfies ReadonlyArray<{ value: ApiServiceBindingRequiredness; label: string }>;

export const adminApiServiceBindingFormSchema = z.object({
  id: z.string().optional(),
  toolKey: z.string().min(1, 'Tool key richiesto'),
  stepKey: z.string().min(1, 'Step key richiesto'),
  workflowStepType: z.literal('acquisition'),
  bindingStatus: z.enum(['active', 'inactive']),
  requiredness: z.enum(['always-required', 'required-by-tool-setting', 'optional-by-tool-setting']),
});

export type AdminApiServiceBindingFormValues = z.infer<typeof adminApiServiceBindingFormSchema>;

export const createEmptyAdminApiServiceBindingForm = (): AdminApiServiceBindingFormValues => ({
  id: undefined,
  toolKey: '',
  stepKey: '',
  workflowStepType: 'acquisition',
  bindingStatus: 'active',
  requiredness: 'required-by-tool-setting',
});

export const createEditAdminApiServiceBindingForm = (binding: ApiServiceBinding): AdminApiServiceBindingFormValues => ({
  id: binding.id,
  toolKey: binding.toolKey,
  stepKey: binding.stepKey,
  workflowStepType: 'acquisition',
  bindingStatus: binding.bindingStatus,
  requiredness: binding.requiredness,
});
