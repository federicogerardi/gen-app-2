export type HttpClientError = {
  code: 'http_error' | 'network_error' | 'unknown_error';
  status: number | null;
  message: string;
  retryable: boolean;
  details?: unknown;
};

export class HttpClientRequestError extends Error implements HttpClientError {
  code: HttpClientError['code'];
  status: number | null;
  retryable: boolean;
  details?: unknown;

  constructor(params: HttpClientError) {
    super(params.message);
    this.name = 'HttpClientRequestError';
    this.code = params.code;
    this.status = params.status;
    this.retryable = params.retryable;
    this.details = params.details;
  }
}

type RequestJsonOptions = RequestInit & {
  expectedStatuses?: number[];
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const isRetryableStatus = (status: number): boolean => {
  return status >= 500;
};

export const isHttpClientError = (error: unknown): error is HttpClientRequestError => {
  return error instanceof HttpClientRequestError;
};

export const joinApiPath = (baseUrl: string, path: string): string => {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}${path}`;
};

export const requestJson = async <TData>(
  url: string,
  options: RequestJsonOptions = {},
): Promise<TData> => {
  const { expectedStatuses = [], ...init } = options;

  try {
    const response = await fetch(url, init);
    if (!response.ok && !expectedStatuses.includes(response.status)) {
      const details = await parseJsonSafely(response);
      throw new HttpClientRequestError({
        code: 'http_error',
        status: response.status,
        message: `HTTP ${response.status}`,
        retryable: isRetryableStatus(response.status),
        details,
      });
    }

    return (await response.json()) as TData;
  } catch (error) {
    if (isHttpClientError(error)) {
      throw error;
    }

    if (error instanceof Error) {
      throw new HttpClientRequestError({
        code: 'network_error',
        status: null,
        message: error.message,
        retryable: true,
      });
    }

    throw new HttpClientRequestError({
      code: 'unknown_error',
      status: null,
      message: 'Unknown client error',
      retryable: true,
    });
  }
};

export const requestVoid = async (
  url: string,
  options: RequestJsonOptions = {},
): Promise<void> => {
  const { expectedStatuses = [], ...init } = options;

  try {
    const response = await fetch(url, init);
    if (!response.ok && !expectedStatuses.includes(response.status)) {
      const details = await parseJsonSafely(response);
      throw new HttpClientRequestError({
        code: 'http_error',
        status: response.status,
        message: `HTTP ${response.status}`,
        retryable: isRetryableStatus(response.status),
        details,
      });
    }
  } catch (error) {
    if (isHttpClientError(error)) {
      throw error;
    }

    if (error instanceof Error) {
      throw new HttpClientRequestError({
        code: 'network_error',
        status: null,
        message: error.message,
        retryable: true,
      });
    }

    throw new HttpClientRequestError({
      code: 'unknown_error',
      status: null,
      message: 'Unknown client error',
      retryable: true,
    });
  }
};
