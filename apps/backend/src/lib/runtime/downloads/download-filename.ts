/**
 * Deterministic filename generator for artifact and session download responses.
 * Filenames are slug-safe: only alphanumeric chars and hyphens, no spaces.
 */

import type { DownloadFormat } from './download-format';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Returns `artifact-{artifactId}.{ext}` with slug-safe normalization.
 */
export const artifactDownloadFilename = (artifactId: string, format: DownloadFormat): string => {
  const safeId = slugify(artifactId);
  return `artifact-${safeId}.${format}`;
};

/**
 * Returns `session-{sessionId}-aggregated.{ext}` with slug-safe normalization.
 */
export const sessionDownloadFilename = (sessionId: string, format: DownloadFormat): string => {
  const safeId = slugify(sessionId);
  return `session-${safeId}-aggregated.${format}`;
};

/**
 * Produces a safe `Content-Disposition: attachment; filename="..."` header value.
 */
export const contentDispositionAttachment = (filename: string): string =>
  `attachment; filename="${filename}"`;
