export type BackendErrorCode =
  | 'unauthorized'
  | 'validation_failed'
  | 'idempotency_conflict'
  | 'rate_limited'
  | 'generation_failed';

export type BackendError = {
  code: BackendErrorCode;
  message: string;
  retryable: boolean;
};

export const mapFailureReasonToBackendError = (
  failureReason: string | null,
): BackendError => {
  if (!failureReason) {
    return {
      code: 'generation_failed',
      message: 'Generation failed with unknown reason',
      retryable: false,
    };
  }

  if (failureReason === 'unauthorized') {
    return {
      code: 'unauthorized',
      message: 'Unauthorized request',
      retryable: false,
    };
  }

  if (failureReason === 'idempotency_conflict') {
    return {
      code: 'idempotency_conflict',
      message: 'Another in-flight request holds the idempotency lock',
      retryable: true,
    };
  }

  if (failureReason === 'rate_limited' || failureReason === 'quota_exhausted') {
    return {
      code: 'rate_limited',
      message: 'Quota or rate-limit exhausted',
      retryable: true,
    };
  }

  if (failureReason === 'usage_failed') {
    return {
      code: 'generation_failed',
      message: 'Usage claim infrastructure failure',
      retryable: true,
    };
  }

  if (failureReason === 'extraction_context_insufficient') {
    return {
      code: 'validation_failed',
      message: 'Extraction context is insufficient for the selected tool',
      retryable: true,
    };
  }

  if (failureReason.includes('validation') || failureReason === 'missing_registry_selector') {
    return {
      code: 'validation_failed',
      message: failureReason,
      retryable: false,
    };
  }

  return {
    code: 'generation_failed',
    message: failureReason,
    retryable: false,
  };
};
