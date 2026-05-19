type ParsedFormat = 'txt' | 'md' | 'docx';

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const normalizeExtractionPayload = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) {
    return {};
  }

  const payload = value.payload;
  if (isRecord(payload)) {
    return payload;
  }

  const extractionPayload = value.extractionPayload;
  if (isRecord(extractionPayload)) {
    return extractionPayload;
  }

  const data = value.data;
  if (isRecord(data)) {
    const dataPayload = data.payload;
    if (isRecord(dataPayload)) {
      return dataPayload;
    }

    const dataExtractionPayload = data.extractionPayload;
    if (isRecord(dataExtractionPayload)) {
      return dataExtractionPayload;
    }
  }

  return value;
};

export const parseJsonCandidate = (candidate: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return normalizeExtractionPayload(parsed);
  } catch {
    return {};
  }
};

export const parseExtractionContent = (content: string): Record<string, unknown> => {
  const direct = parseJsonCandidate(content);
  if (Object.keys(direct).length > 0) {
    return direct;
  }

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = parseJsonCandidate(fenced[1]);
    if (Object.keys(fromFence).length > 0) {
      return fromFence;
    }
  }

  const objectSlice = content.match(/\{[\s\S]*\}/);
  if (objectSlice?.[0]) {
    const fromSlice = parseJsonCandidate(objectSlice[0]);
    if (Object.keys(fromSlice).length > 0) {
      return fromSlice;
    }
  }

  return {};
};

export const parsedFormatFromInput = (input: Record<string, unknown>): ParsedFormat => {
  const raw = typeof input.parsedFormat === 'string' ? input.parsedFormat.trim().toLowerCase() : '';
  if (raw === 'txt' || raw === 'md' || raw === 'docx') {
    return raw;
  }
  return 'md';
};