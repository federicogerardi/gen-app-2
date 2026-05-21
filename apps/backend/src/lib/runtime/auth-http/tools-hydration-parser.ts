type ParsedFormat = 'txt' | 'md' | 'docx';

export const parsedFormatFromInput = (input: Record<string, unknown>): ParsedFormat => {
  const raw = typeof input.parsedFormat === 'string' ? input.parsedFormat.trim().toLowerCase() : '';
  if (raw === 'txt' || raw === 'md' || raw === 'docx') {
    return raw;
  }
  return 'md';
};