import { useState } from 'react';

import { appCopy } from '../../../app/copy/system';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import {
  createAdminApiService,
  deleteAdminApiService,
  updateAdminApiService,
  type CreateAdminApiServiceInput,
  type UpdateAdminApiServiceInput,
} from './admin-client';
import { useAdminMutationFeedback } from './useAdminMutationFeedback';

export type AdminApiServicesBusyAction = 'create' | `update:${string}` | `delete:${string}` | null;

type UseAdminApiServicesMutationsOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  reloadApiServices: () => void;
  onCreateReset: () => void;
  onEditClosed: () => void;
};

export const useAdminApiServicesMutations = ({
  apiBaseUrl,
  capabilities,
  reloadApiServices,
  onCreateReset,
  onEditClosed,
}: UseAdminApiServicesMutationsOptions) => {
  const { publishSuccess, publishError } = useAdminMutationFeedback();
  const [busyAction, setBusyAction] = useState<AdminApiServicesBusyAction>(null);

  const createApiService = async (data: CreateAdminApiServiceInput) => {
    setBusyAction('create');

    try {
      await createAdminApiService(data, { apiBaseUrl, capabilities });
      onCreateReset();
      publishSuccess(appCopy.ui.feedback.adminApiServicesCreated, 'admin-api-services:create:success');
      reloadApiServices();
    } catch {
      publishError(appCopy.ui.feedback.adminApiServicesCreateFailed, 'admin-api-services:create:error');
    } finally {
      setBusyAction(null);
    }
  };

  const updateApiService = async (apiServiceId: string, data: UpdateAdminApiServiceInput) => {
    setBusyAction(`update:${apiServiceId}`);

    try {
      await updateAdminApiService(apiServiceId, data, { apiBaseUrl, capabilities });
      onEditClosed();
      publishSuccess(appCopy.ui.feedback.adminApiServicesUpdated, `admin-api-services:update:${apiServiceId}:success`);
      reloadApiServices();
    } catch {
      publishError(appCopy.ui.feedback.adminApiServicesUpdateFailed, `admin-api-services:update:${apiServiceId}:error`);
    } finally {
      setBusyAction(null);
    }
  };

  const deleteApiService = async (apiServiceId: string) => {
    setBusyAction(`delete:${apiServiceId}`);

    try {
      await deleteAdminApiService(apiServiceId, { apiBaseUrl, capabilities });
      onEditClosed();
      publishSuccess(appCopy.ui.feedback.adminApiServicesDeleted, `admin-api-services:delete:${apiServiceId}:success`);
      reloadApiServices();
    } catch {
      publishError(appCopy.ui.feedback.adminApiServicesDeleteFailed, `admin-api-services:delete:${apiServiceId}:error`);
    } finally {
      setBusyAction(null);
    }
  };

  return {
    busyAction,
    createApiService,
    updateApiService,
    deleteApiService,
  };
};
