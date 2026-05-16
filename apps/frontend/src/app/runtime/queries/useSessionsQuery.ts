import { useCallback } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import {
  listSessions,
  type SessionSummary,
} from '../../../features/tools/runtime/session-client';
import { useAsyncQuery } from './useAsyncQuery';

type UseSessionsQueryOptions = {
  projectId?: string;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

type UseSessionsQueryResult = {
  data: SessionSummary[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useSessionsQuery = (options: UseSessionsQueryOptions): UseSessionsQueryResult => {
  const projectIdKey = options.projectId ?? '';
  const dependencyKey = JSON.stringify([projectIdKey, options.apiBaseUrl, options.capabilities]);
  const query = useCallback(() => listSessions(
    projectIdKey ? { projectId: projectIdKey } : {},
    { apiBaseUrl: options.apiBaseUrl, capabilities: options.capabilities as BackendCapabilities },
  ), [projectIdKey, options.apiBaseUrl, options.capabilities]);

  return useAsyncQuery<SessionSummary[]>({
    enabled: options.enabled ?? true,
    emptyData: [],
    errorMessage: 'Unable to load sessions',
    dependencyKey,
    query,
  });
};
