/**
 * Frontend download client for Artifact and SessionSummary download endpoints.
 * Uses the API path builder and programmatic anchor-based file save (Blob URL pattern).
 */

import { buildApiPaths } from '../../../app/runtime/api-paths';
import { resolveBackendCapabilities, type BackendCapabilities } from '../../../app/runtime/backend-capabilities';

export type DownloadFormat = 'md' | 'txt' | 'docx';

type DownloadClientOptions = {
  apiBaseUrl: string;
  capabilities: Partial<BackendCapabilities>;
};

/** Options specific to session downloads. */
export type SessionDownloadOptions = {
  /** Optional step keys to exclude from the downloaded content (DDD-135). */
  excludeSteps?: string[];
};

const triggerBlobDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

/**
 * Downloads a single Artifact as the specified format.
 * Invokes `GET /api/artifacts/:artifactId/download?format=...`
 */
export const downloadArtifactFile = async (
  artifactId: string,
  format: DownloadFormat,
  options: DownloadClientOptions,
): Promise<void> => {
  const paths = buildApiPaths(resolveBackendCapabilities(options.capabilities));
  const url = paths.artifacts.downloadById(artifactId, format);
  if (!url) {
    throw new Error('Artifact download capability is not enabled');
  }

  const fullUrl = options.apiBaseUrl ? `${options.apiBaseUrl}${url}` : url;
  const response = await fetch(fullUrl, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const filename = `artifact-${artifactId}.${format}`;
  triggerBlobDownload(blob, filename);
};

/**
 * Downloads an aggregated session file as the specified format.
 * Invokes `GET /api/tools/sessions/:sessionId/download?format=...&excludeSteps=...`
 */
export const downloadSessionFile = async (
  sessionId: string,
  format: DownloadFormat,
  options: DownloadClientOptions,
  sessionOptions?: SessionDownloadOptions,
): Promise<void> => {
  const paths = buildApiPaths(resolveBackendCapabilities(options.capabilities));
  const url = paths.tools.sessions.downloadById(sessionId, format, sessionOptions?.excludeSteps);
  if (!url) {
    throw new Error('Session download capability is not enabled');
  }

  const fullUrl = options.apiBaseUrl ? `${options.apiBaseUrl}${url}` : url;
  const response = await fetch(fullUrl, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const filename = `session-${sessionId}-aggregated.${format}`;
  triggerBlobDownload(blob, filename);
};
