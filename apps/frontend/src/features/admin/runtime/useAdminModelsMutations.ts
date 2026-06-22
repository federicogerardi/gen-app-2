import { useState } from 'react';

import { appCopy } from '../../../app/copy/system';
import { joinApiPath, requestJson, requestVoid } from '../../../app/runtime/http-client';
import type { AdminLlmModelRow } from '../llm/LLMTable';
import type { AdminModelFormValues } from './admin-models-form';
import { useAdminMutationFeedback } from './useAdminMutationFeedback';

export type AdminModelsBusyAction = 'create' | `default:${string}` | `toggle:${string}` | `delete:${string}` | null;

type UseAdminModelsMutationsOptions = {
  apiBaseUrl: string;
  reloadModels: () => void;
};

export const useAdminModelsMutations = ({ apiBaseUrl, reloadModels }: UseAdminModelsMutationsOptions) => {
  const { publishSuccess, publishError } = useAdminMutationFeedback();
  const [busyAction, setBusyAction] = useState<AdminModelsBusyAction>(null);

  const createModel = async (data: AdminModelFormValues, reset: () => void) => {
    setBusyAction('create');

    try {
      await requestJson(joinApiPath(apiBaseUrl, '/api/admin/models'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: data.key.trim(), label: data.label.trim(), status: data.status }),
      });

      reset();
      publishSuccess(appCopy.ui.feedback.adminModelsCreated, 'admin-models:create:success');
      reloadModels();
    } catch {
      publishError(appCopy.ui.feedback.adminModelsCreateFailed, 'admin-models:create:error');
    } finally {
      setBusyAction(null);
    }
  };

  const setDefaultModel = async (model: AdminLlmModelRow) => {
    if (model.isDefault) return;
    setBusyAction(`default:${model.id}`);

    try {
      await requestJson(joinApiPath(apiBaseUrl, `/api/admin/models/${model.id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      publishSuccess(appCopy.ui.feedback.adminModelsDefaultUpdated, `admin-models:default:${model.id}:success`);
      reloadModels();
    } catch {
      publishError(appCopy.ui.feedback.adminModelsDefaultUpdateFailed, `admin-models:default:${model.id}:error`);
    } finally {
      setBusyAction(null);
    }
  };

  const toggleStatus = async (model: AdminLlmModelRow) => {
    const nextStatus = model.status === 'enabled' ? 'disabled' : 'enabled';
    setBusyAction(`toggle:${model.id}`);

    try {
      await requestJson(joinApiPath(apiBaseUrl, `/api/admin/models/${model.id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      publishSuccess(appCopy.ui.feedback.adminModelsStatusUpdated, `admin-models:toggle:${model.id}:success`);
      reloadModels();
    } catch {
      publishError(appCopy.ui.feedback.adminModelsStatusUpdateFailed, `admin-models:toggle:${model.id}:error`);
    } finally {
      setBusyAction(null);
    }
  };

  const deleteModel = async (model: AdminLlmModelRow) => {
    if (!window.confirm(`Delete model "${model.key}"? This cannot be undone.`)) return;
    setBusyAction(`delete:${model.id}`);

    try {
      await requestVoid(joinApiPath(apiBaseUrl, `/api/admin/models/${model.id}`), { method: 'DELETE' });

      publishSuccess(appCopy.ui.feedback.adminModelsDeleted, `admin-models:delete:${model.id}:success`);
      reloadModels();
    } catch {
      publishError(appCopy.ui.feedback.adminModelsDeleteFailed, `admin-models:delete:${model.id}:error`);
    } finally {
      setBusyAction(null);
    }
  };

  return {
    busyAction,
    createModel,
    setDefaultModel,
    toggleStatus,
    deleteModel,
  };
};