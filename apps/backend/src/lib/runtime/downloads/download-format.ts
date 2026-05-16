/**
 * Canonical download format type and parser for artifact/session download endpoints.
 * Supported formats: md, txt, docx.
 */

export type DownloadFormat = 'md' | 'txt' | 'docx';

const SUPPORTED_FORMATS = new Set<DownloadFormat>(['md', 'txt', 'docx']);

export const isSupportedDownloadFormat = (value: string): value is DownloadFormat =>
  SUPPORTED_FORMATS.has(value as DownloadFormat);

/**
 * Parses and validates the `format` query parameter from a URLSearchParams instance.
 * Returns the parsed DownloadFormat or `null` if absent or invalid.
 */
export const parseDownloadFormat = (searchParams: URLSearchParams): DownloadFormat | null => {
  const raw = searchParams.get('format');
  if (!raw || !isSupportedDownloadFormat(raw.trim().toLowerCase())) {
    return null;
  }
  return raw.trim().toLowerCase() as DownloadFormat;
};

export const contentTypeForFormat = (format: DownloadFormat): string => {
  if (format === 'md') return 'text/markdown; charset=utf-8';
  if (format === 'txt') return 'text/plain; charset=utf-8';
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
};
