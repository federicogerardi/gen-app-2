import { useCallback, useEffect, useRef, useState } from 'react';

type UseAsyncQueryOptions<TData> = {
  enabled?: boolean;
  emptyData: TData;
  errorMessage: string;
  dependencyKey: string;
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
  dependencyKey,
  query,
}: UseAsyncQueryOptions<TData>): UseAsyncQueryResult<TData> => {
  const [data, setData] = useState<TData>(emptyData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const emptyDataRef = useRef(emptyData);
  const errorMessageRef = useRef(errorMessage);
  const queryRef = useRef(query);

  emptyDataRef.current = emptyData;
  errorMessageRef.current = errorMessage;
  queryRef.current = query;

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(emptyDataRef.current);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const nextData = await queryRef.current();

        if (cancelled) {
          return;
        }

        setData(nextData);
        setError(null);
      } catch (queryError) {
        if (cancelled) {
          return;
        }

        setData(emptyDataRef.current);
        setError(readErrorMessage(queryError, errorMessageRef.current));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dependencyKey, enabled, reloadToken]);

  return {
    data,
    loading,
    error,
    reload,
  };
};
