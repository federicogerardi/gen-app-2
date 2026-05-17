import useSWR from 'swr';

export type SWRQueryResult<TData> = {
  data: TData;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

type UseSWRQueryOptions<TData> = {
  key: unknown[] | null;
  fetcher: () => Promise<TData>;
  emptyData: TData;
  errorMessage: string;
};

const readErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

export const useSWRQuery = <TData>({
  key,
  fetcher,
  emptyData,
  errorMessage,
}: UseSWRQueryOptions<TData>): SWRQueryResult<TData> => {
  const { data, error, isLoading, mutate } = useSWR<TData, Error>(
    key,
    fetcher,
    { revalidateOnFocus: false },
  );

  return {
    data: data ?? emptyData,
    loading: isLoading,
    error: error ? readErrorMessage(error, errorMessage) : null,
    reload: () => void mutate(),
  };
};
