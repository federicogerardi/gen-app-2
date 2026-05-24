/**
 * Central configuration for SSE stream / generation lifecycle tuning.
 * Import from here instead of scattering literals across machines and providers.
 */

export const STREAM_CONFIG = {
  reconnect: {
    /** Maximum number of reconnection attempts before giving up */
    maxAttempts: 3,
    /** Base exponential-backoff delay (ms) between reconnection attempts */
    baseDelayMs: 500,
    /** Maximum backoff delay (ms); caps the exponential growth */
    maxDelayMs: 4000,
    /** Random jitter ceiling (ms) added to each reconnection delay */
    jitterMs: 250,
  },
  /** Default maximum step-retry count for the generation lifecycle machine */
  defaultMaxRetries: 3,
} as const;
