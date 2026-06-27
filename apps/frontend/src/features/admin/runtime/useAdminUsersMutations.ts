import { useState } from 'react';

import { appCopy } from '../../../app/copy/system';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { createAdminUser, deleteAdminUser, updateAdminUser } from './admin-client';
import { parseOptionalNumber, type AdminUserFormValues } from './admin-user-form';
import { useAdminMutationFeedback } from './useAdminMutationFeedback';

export type AdminUsersBusyAction = 'create' | `update:${string}` | `delete:${string}` | null;

type UseAdminUsersMutationsOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  editingUserId: string | null;
  reloadUsers: () => void;
  onCreateReset: () => void;
  onEditClosed: () => void;
};

export const useAdminUsersMutations = ({
  apiBaseUrl,
  capabilities,
  editingUserId,
  reloadUsers,
  onCreateReset,
  onEditClosed,
}: UseAdminUsersMutationsOptions) => {
  const { publishSuccess, publishError } = useAdminMutationFeedback();
  const [busyAction, setBusyAction] = useState<AdminUsersBusyAction>(null);

  const createUser = async (data: AdminUserFormValues) => {
    setBusyAction('create');

    try {
      const monthlyQuota = parseOptionalNumber(data.monthlyQuota);
      const monthlyArtifactLimit = parseOptionalNumber(data.monthlyArtifactLimit);
      await createAdminUser({
        email: data.email.trim(),
        role: data.role,
        status: data.status,
        ...(data.password ? { password: data.password } : {}),
        ...(monthlyQuota !== undefined ? { monthlyQuota } : {}),
        ...(monthlyArtifactLimit !== undefined ? { monthlyArtifactLimit } : {}),
      }, {
        apiBaseUrl,
        capabilities,
      });

      onCreateReset();
      publishSuccess(appCopy.ui.feedback.adminUsersCreated, 'admin-users:create:success');
      reloadUsers();
    } catch {
      publishError(appCopy.ui.feedback.adminUsersCreateFailed, 'admin-users:create:error');
    } finally {
      setBusyAction(null);
    }
  };

  const updateUser = async (userId: string, data: AdminUserFormValues) => {
    setBusyAction(`update:${userId}`);

    try {
      const monthlyQuota = parseOptionalNumber(data.monthlyQuota);
      const monthlyArtifactLimit = parseOptionalNumber(data.monthlyArtifactLimit);
      await updateAdminUser(userId, {
        email: data.email.trim(),
        role: data.role,
        status: data.status,
        ...(data.password ? { password: data.password } : {}),
        ...(monthlyQuota !== undefined ? { monthlyQuota } : {}),
        ...(monthlyArtifactLimit !== undefined ? { monthlyArtifactLimit } : {}),
      }, {
        apiBaseUrl,
        capabilities,
      });

      onEditClosed();
      publishSuccess(appCopy.ui.feedback.adminUsersUpdated, `admin-users:update:${userId}:success`);
      reloadUsers();
    } catch {
      publishError(appCopy.ui.feedback.adminUsersUpdateFailed, `admin-users:update:${userId}:error`);
    } finally {
      setBusyAction(null);
    }
  };

  const disableUser = async (userId: string) => {
    setBusyAction(`delete:${userId}`);

    try {
      await deleteAdminUser(userId, {
        apiBaseUrl,
        capabilities,
      });

      if (editingUserId === userId) {
        onEditClosed();
      }

      publishSuccess(appCopy.ui.feedback.adminUsersDisabled, `admin-users:delete:${userId}:success`);
      reloadUsers();
    } catch {
      publishError(appCopy.ui.feedback.adminUsersDisableFailed, `admin-users:delete:${userId}:error`);
    } finally {
      setBusyAction(null);
    }
  };

  return {
    busyAction,
    createUser,
    updateUser,
    disableUser,
  };
};