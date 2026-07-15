const MAX_QUERY_LOG_LENGTH = 80;

const truncateString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  return value.length > MAX_QUERY_LOG_LENGTH
    ? `${value.slice(0, MAX_QUERY_LOG_LENGTH)}…`
    : value;
};

/**
 * Pino serializers that replace geometric-logger sanitizeMeta.
 * Applied globally to every log call via logger.ts configuration.
 */
export const serializers = {
  baseQuery: truncateString,
  paaQuery: truncateString,
  // Never log binary or raw HTML content
  htmlContent: () => undefined,
  rawBuffer: () => undefined,
};
