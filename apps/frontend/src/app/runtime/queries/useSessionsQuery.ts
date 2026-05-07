import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import {
  listSessions,
  type SessionSummary,
} from '../../../features/tools/runtime/session-client';

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
  const [data, setData] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  const projectIdKey = options.projectId ?? '';
  const apiBaseUrl = options.apiBaseUrl;
  const capabilitiesKey = JSON.stringify(options.capabilities);
  const sessionsQueryKey = `sessionsummary:${projectIdKey}:${apiBaseUrl}:${capabilitiesKey}`;
  const enabledRef = useRef(options.enabled);
  enabledRef.current = options.enabled;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (enabledRef.current === false) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const sessions = await listSessions(
          projectIdKey ? { projectId: projectIdKey } : {},
          { apiBaseUrl, capabilities: JSON.parse(capabilitiesKey) as BackendCapabilities },
        );

        if (cancelled) {
          return;
        }

        setData(sessions);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setData([]);
        const message = loadError instanceof Error ? loadError.message : 'Unable to load sessions';
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionsQueryKey, projectIdKey, apiBaseUrl, capabilitiesKey, reloadToken]);

  return { data, loading, error, reload };
};
