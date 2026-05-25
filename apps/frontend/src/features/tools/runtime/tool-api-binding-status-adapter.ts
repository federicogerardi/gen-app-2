import { useMemo } from 'react';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { buildApiPaths } from '../../../app/runtime/api-paths';
import { requestJson, joinApiPath } from '../../../app/runtime/http-client';
import type {
  ToolApiAcquisitionPolicyEntry,
} from './tool-form-architecture';
import { useSWRQuery, type SWRQueryResult } from '../../../app/runtime/queries/useSWRQuery';

export type ToolApiBindingStatusView = {
  key: string;
  connected: boolean;
  bindingLabel: string | null;
};

type ResolveApiServiceEnvelope = {
  data?: {
    apiService?: {
      status?: string;
    };
    resolveContract?: {
      bindings?: Array<{
        id?: string;
        toolKey?: string;
        bindingStatus?: string;
      }>;
    };
  };
};

const readFeatureFlag = (): boolean => {
  const raw = (import.meta.env.VITE_FF_TOOLS_API_BINDING_STATUS as string | undefined)?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

export const isToolApiBindingStatusAdapterEnabled = (): boolean => readFeatureFlag();

const resolveSingleApiServiceBindingStatus = async ({
  apiBaseUrl,
  capabilities,
  toolKey,
  apiServiceId,
}: {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  toolKey: string;
  apiServiceId: string;
}): Promise<ToolApiBindingStatusView> => {
  const path = buildApiPaths(capabilities).tools.apiServicesResolve(apiServiceId);
  if (!path) {
    return {
      key: apiServiceId,
      connected: false,
      bindingLabel: null,
    };
  }

  try {
    const payload = await requestJson<ResolveApiServiceEnvelope>(joinApiPath(apiBaseUrl, path), {
      method: 'GET',
      credentials: 'include',
    });

    const apiServiceActive = payload.data?.apiService?.status === 'active';
    const activeBinding = (payload.data?.resolveContract?.bindings ?? []).find((binding) => (
      binding.toolKey === toolKey && binding.bindingStatus === 'active'
    ));

    return {
      key: apiServiceId,
      connected: apiServiceActive && Boolean(activeBinding),
      bindingLabel: activeBinding?.id ?? null,
    };
  } catch {
    return {
      key: apiServiceId,
      connected: false,
      bindingLabel: null,
    };
  }
};

export const resolveToolApiBindingStatuses = async ({
  apiBaseUrl,
  capabilities,
  toolKey,
  apiAcquisitionInputs,
}: {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  toolKey: string;
  apiAcquisitionInputs: readonly ToolApiAcquisitionPolicyEntry[];
}): Promise<ToolApiBindingStatusView[]> => {
  if (apiAcquisitionInputs.length === 0) {
    return [];
  }

  return Promise.all(
    apiAcquisitionInputs.map((input) => resolveSingleApiServiceBindingStatus({
      apiBaseUrl,
      capabilities,
      toolKey,
      apiServiceId: input.key,
    })),
  );
};

export const useToolApiBindingStatusAdapter = ({
  apiBaseUrl,
  capabilities,
  toolKey,
  apiAcquisitionInputs,
}: {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  toolKey: string;
  apiAcquisitionInputs: readonly ToolApiAcquisitionPolicyEntry[];
}): SWRQueryResult<ToolApiBindingStatusView[]> & { enabled: boolean } => {
  const enabled = useMemo(() => (
    isToolApiBindingStatusAdapterEnabled() && apiAcquisitionInputs.length > 0
  ), [apiAcquisitionInputs.length]);

  const query = useSWRQuery<ToolApiBindingStatusView[]>({
    key: enabled ? [apiBaseUrl, capabilities, toolKey, ...apiAcquisitionInputs.map((entry) => entry.key)] : null,
    fetcher: () => resolveToolApiBindingStatuses({
      apiBaseUrl,
      capabilities,
      toolKey,
      apiAcquisitionInputs,
    }),
    emptyData: [],
    errorMessage: 'Unable to resolve ApiService binding status',
  });

  return {
    ...query,
    enabled,
  };
};
