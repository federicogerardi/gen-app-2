import type { BackendCapabilities } from '../../runtime/backend-capabilities';
import { appCopy } from '../../copy/system';
import {
  listAdminSessions,
  type AdminSessionSummary,
} from '../../../features/admin/runtime/admin-session-client';
import { useSWRQuery, type SWRQueryResult } from './useSWRQuery';

type UseAdminSessionsQueryOptions = {
  projectId?: string;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

export const useAdminSessionsQuery = (options: UseAdminSessionsQueryOptions): SWRQueryResult<AdminSessionSummary[]> => {
  const projectIdKey = options.projectId ?? '';
  const enabled = options.enabled ?? true;

  return useSWRQuery<AdminSessionSummary[]>({
    key: enabled ? [projectIdKey, options.apiBaseUrl, 'admin-sessions'] : null,
    fetcher: () => listAdminSessions(
      projectIdKey ? { projectId: projectIdKey } : {},
      { apiBaseUrl: options.apiBaseUrl },
    ),
    emptyData: [],
    errorMessage: appCopy.ui.fallbackErrors.loadAdminSessions,
  });
};
