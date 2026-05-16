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
  const capabilitiesKey = JSON.stringify(options.capabilities);

  return useAsyncQuery<SessionSummary[]>({
    enabled: options.enabled ?? true,
    emptyData: [],
    errorMessage: 'Unable to load sessions',
    dependencies: [projectIdKey, options.apiBaseUrl, capabilitiesKey],
    query: () => listSessions(
      projectIdKey ? { projectId: projectIdKey } : {},
      { apiBaseUrl: options.apiBaseUrl, capabilities: options.capabilities as BackendCapabilities },
    ),
  });
};
