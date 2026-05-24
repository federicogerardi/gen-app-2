import { useState } from 'react';

import { appCopy } from '../../../app/copy/system';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import {
  deleteAdminApiServiceBinding,
  upsertAdminApiServiceBinding,
  type ApiServiceBinding,
  type UpsertAdminApiServiceBindingInput,
} from './admin-client';
import { useAdminMutationFeedback } from './useAdminMutationFeedback';

export type AdminApiServiceBindingsBusyAction = 'create' | `update:${string}` | `delete:${string}` | null;

type UseAdminApiServiceBindingsMutationsOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  apiServiceId: string | null;
  reloadBindings: () => void;
  onBindingSelected?: (binding: ApiServiceBinding | null) => void;
};

export const useAdminApiServiceBindingsMutations = ({
  apiBaseUrl,
  capabilities,
  apiServiceId,
  reloadBindings,
  onBindingSelected,
}: UseAdminApiServiceBindingsMutationsOptions) => {
  const { publishSuccess, publishError } = useAdminMutationFeedback();
  const [busyAction, setBusyAction] = useState<AdminApiServiceBindingsBusyAction>(null);

  const saveBinding = async (input: UpsertAdminApiServiceBindingInput) => {
    if (!apiServiceId) {
      publishError(appCopy.ui.feedback.adminApiServiceBindingsSaveFailed, 'admin-api-service-bindings:save:no-service');
      return;
    }

    const action = input.id ? `update:${input.id}` : 'create';
    setBusyAction(action as AdminApiServiceBindingsBusyAction);

    try {
      const binding = await upsertAdminApiServiceBinding(apiServiceId, input, { apiBaseUrl, capabilities });
      onBindingSelected?.(binding);
      publishSuccess(appCopy.ui.feedback.adminApiServiceBindingsSaved, `admin-api-service-bindings:save:${binding.id}:success`);
      reloadBindings();
    } catch {
      publishError(appCopy.ui.feedback.adminApiServiceBindingsSaveFailed, `admin-api-service-bindings:save:${input.id ?? 'new'}:error`);
    } finally {
      setBusyAction(null);
    }
  };

  const removeBinding = async (bindingId: string) => {
    if (!apiServiceId) {
      publishError(appCopy.ui.feedback.adminApiServiceBindingsDeleteFailed, 'admin-api-service-bindings:delete:no-service');
      return;
    }

    setBusyAction(`delete:${bindingId}`);

    try {
      await deleteAdminApiServiceBinding(apiServiceId, bindingId, { apiBaseUrl, capabilities });
      onBindingSelected?.(null);
      publishSuccess(appCopy.ui.feedback.adminApiServiceBindingsDeleted, `admin-api-service-bindings:delete:${bindingId}:success`);
      reloadBindings();
    } catch {
      publishError(appCopy.ui.feedback.adminApiServiceBindingsDeleteFailed, `admin-api-service-bindings:delete:${bindingId}:error`);
    } finally {
      setBusyAction(null);
    }
  };

  return {
    busyAction,
    saveBinding,
    removeBinding,
  };
};