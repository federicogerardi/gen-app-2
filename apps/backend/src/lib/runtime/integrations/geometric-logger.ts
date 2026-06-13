/**
 * Geometric Tool — Structured Server Logging
 *
 * Standardizes log output for all Geometric operations with consistent
 * prefixing, metadata, and PII/data-size safety.
 *
 * Pattern: follows existing project conventions (console.info/warn/error)
 * with prefixed tag `[geometric]` + operation label + JSON metadata.
 *
 * Safety rules:
 *  - NEVER log screenshot binary data (base64, buffers)
 *  - NEVER log full HTML content (only lengths / truncated snippets)
 *  - NEVER log user query strings beyond first 80 chars
 *  - ALWAYS include requestId for cross-step correlation
 */

export type GeometricLogMeta = {
  requestId: string;
  stepKey?: string;
  toolKey?: string;
  operation: string;
  durationMs?: number;
  sourceCount?: number;
  paaCount?: number;
  competitorCount?: number;
  error?: string;
  [key: string]: unknown;
};

const MAX_QUERY_LOG_LENGTH = 80;

const truncateQuery = (q: string): string =>
  q.length > MAX_QUERY_LOG_LENGTH ? `${q.slice(0, MAX_QUERY_LOG_LENGTH)}…` : q;

const sanitizeMeta = (meta: GeometricLogMeta): GeometricLogMeta => {
  const sanitized = { ...meta };
  if (typeof sanitized.baseQuery === 'string') {
    sanitized.baseQuery = truncateQuery(sanitized.baseQuery);
  }
  if (typeof sanitized.paaQuery === 'string') {
    sanitized.paaQuery = truncateQuery(sanitized.paaQuery);
  }
  // NEVER forward screenshot or raw HTML content
  delete sanitized.screenshot;
  delete sanitized.htmlContent;
  delete sanitized.rawBuffer;
  return sanitized;
};

export const logGeometricInfo = (message: string, meta: GeometricLogMeta): void => {
  console.info(`[geometric] ${message}`, sanitizeMeta(meta));
};

export const logGeometricWarn = (message: string, meta: GeometricLogMeta): void => {
  console.warn(`[geometric] ${message}`, sanitizeMeta(meta));
};

export const logGeometricError = (message: string, meta: GeometricLogMeta): void => {
  console.error(`[geometric] ${message}`, sanitizeMeta(meta));
};

export const logGeometricDebug = (message: string, meta: GeometricLogMeta): void => {
  console.debug(`[geometric] ${message}`, sanitizeMeta(meta));
};
