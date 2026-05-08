import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import {
  listEnabledModels,
  type LlmModelOption,
} from '../../../features/tools/runtime/models-client';

type UseModelsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

type UseModelsQueryResult = {
  data: LlmModelOption[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useModelsQuery = (options: UseModelsQueryOptions): UseModelsQueryResult => {
  const [data, setData] = useState<LlmModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  const apiBaseUrl = options.apiBaseUrl;
  const capabilitiesKey = JSON.stringify(options.capabilities);
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
        const models = await listEnabledModels({
          apiBaseUrl,
          capabilities: JSON.parse(capabilitiesKey) as BackendCapabilities,
        });

        if (cancelled) {
          return;
        }

        setData(models);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setData([]);
        const message = loadError instanceof Error ? loadError.message : 'Unable to load models';
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
  }, [apiBaseUrl, capabilitiesKey, reloadToken]);

  return { data, loading, error, reload };
};
