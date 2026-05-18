export type GenerationRetryEscalationPolicy = {
  maxAttempts?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onEscalation?: (error: unknown, attempts: number) => void;
};

const DEFAULT_POLICY: Required<GenerationRetryEscalationPolicy> = {
  maxAttempts: 1,
  shouldRetry: () => false,
  onEscalation: () => undefined,
};

export const runWithGenerationRetryPolicy = async <T>(
  operation: () => Promise<T>,
  policy: GenerationRetryEscalationPolicy = {},
): Promise<T> => {
  const resolvedPolicy: Required<GenerationRetryEscalationPolicy> = {
    maxAttempts: Math.max(1, policy.maxAttempts ?? DEFAULT_POLICY.maxAttempts),
    shouldRetry: policy.shouldRetry ?? DEFAULT_POLICY.shouldRetry,
    onEscalation: policy.onEscalation ?? DEFAULT_POLICY.onEscalation,
  };

  let attempt = 0;
  while (attempt < resolvedPolicy.maxAttempts) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      const canRetry = attempt < resolvedPolicy.maxAttempts
        && resolvedPolicy.shouldRetry(error, attempt);
      if (canRetry) {
        continue;
      }

      resolvedPolicy.onEscalation(error, attempt);
      throw error;
    }
  }

  throw new Error('generation_retry_policy_exhausted');
};
