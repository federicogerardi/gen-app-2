import type { BackendCapabilities } from '../backend-capabilities';
import {
  listSessions,
  type SessionSummary,
} from '../../../features/tools/runtime/session-client';
import { useSWRQuery, type SWRQueryResult } from './useSWRQuery';

type UseSessionsQueryOptions = {
  projectId?: string;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

export const useSessionsQuery = (options: UseSessionsQueryOptions): SWRQueryResult<SessionSummary[]> => {
  const projectIdKey = options.projectId ?? '';
  const enabled = options.enabled ?? true;

  return useSWRQuery<SessionSummary[]>({
    key: enabled ? [projectIdKey, options.apiBaseUrl, options.capabilities, 'sessions'] : null,
    fetcher: () => listSessions(
      projectIdKey ? { projectId: projectIdKey } : {},
      { apiBaseUrl: options.apiBaseUrl, capabilities: options.capabilities },
    ),
    emptyData: [],
    errorMessage: 'Unable to load sessions',
  });
};
