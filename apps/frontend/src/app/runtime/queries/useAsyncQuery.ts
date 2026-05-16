import { useCallback, useEffect, useState } from 'react';

type UseAsyncQueryOptions<TData> = {
  enabled?: boolean;
  emptyData: TData;
  errorMessage: string;
  dependencies: readonly unknown[];
  query: () => Promise<TData>;
};

type UseAsyncQueryResult<TData> = {
  data: TData;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const readErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

export const useAsyncQuery = <TData>({
  enabled = true,
  emptyData,
  errorMessage,
  dependencies,
  query,
}: UseAsyncQueryOptions<TData>): UseAsyncQueryResult<TData> => {
  const [data, setData] = useState<TData>(emptyData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(emptyData);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const nextData = await query();

        if (cancelled) {
          return;
        }

        setData(nextData);
        setError(null);
      } catch (queryError) {
        if (cancelled) {
          return;
        }

        setData(emptyData);
        setError(readErrorMessage(queryError, errorMessage));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers provide dependency keys explicitly
  }, [enabled, reloadToken, ...dependencies]);

  return {
    data,
    loading,
    error,
    reload,
  };
};
