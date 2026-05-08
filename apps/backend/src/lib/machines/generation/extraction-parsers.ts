import { normalizeToolWorkflowKey } from '../../runtime/workflow-normalizers';
import { toOptionalString, toStringArray } from './request-normalizers';

const countWords = (value: string): number => {
  return value.split(/\s+/).filter((token) => token.length > 0).length;
};

const YOUTUBE_EXTRACTION_SECTION_BY_HEADING: Record<string, string> = {
  'knowledge content': 'knowledge_content',
  avatar: 'avatar',
  'pain point': 'pain_point',
  'purchase process type': 'purchase_process_type',
  offer: 'offer',
  proof: 'proof',
  tone: 'tone',
  'target duration minutes': 'target_duration_minutes',
  'proprietary methodology disclosure': 'proprietary_methodology_disclosure',
};

const MISSING_EXTRACTION_VALUE_MARKERS = new Set([
  'non emerso dal documento.',
  'non emerso dal documento',
]);

export const normalizeYoutubeExtractionField = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (MISSING_EXTRACTION_VALUE_MARKERS.has(normalized.toLowerCase())) {
    return null;
  }

  return normalized;
};

export const parseYoutubeExtractionMarkdown = (content: string): Record<string, unknown> => {
  if (!content.trim()) {
    return {};
  }

  const rows = content.split(/\r?\n/);
  const extractedFields: Record<string, string | null> = {};
  let currentField: string | null = null;

  for (const row of rows) {
    const headingMatch = row.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      const headingLabel = headingMatch[1];
      if (!headingLabel) {
        currentField = null;
        continue;
      }
      const heading = headingLabel.trim().toLowerCase();
      currentField = YOUTUBE_EXTRACTION_SECTION_BY_HEADING[heading] ?? null;
      continue;
    }

    if (!currentField) {
      continue;
    }

    const bulletMatch = row.match(/^\s*-\s*(.+?)\s*$/);
    if (!bulletMatch) {
      continue;
    }
    const bulletValue = bulletMatch[1];
    if (!bulletValue) {
      continue;
    }

    const current = extractedFields[currentField];
    if (current !== undefined && current !== null) {
      continue;
    }

    extractedFields[currentField] = normalizeYoutubeExtractionField(bulletValue);
  }

  const result: Record<string, unknown> = {};
  for (const field of Object.values(YOUTUBE_EXTRACTION_SECTION_BY_HEADING)) {
    result[field] = extractedFields[field] ?? null;
  }
  return result;
};

export const parseExtractionContent = (
  content: string,
  extractionToolKey: string | null | undefined,
): Record<string, unknown> => {
  if (!content) {
    return {};
  }

  const normalizedExtractionToolKey = normalizeToolWorkflowKey(extractionToolKey);
  if (normalizedExtractionToolKey === 'youtube-lf-script') {
    return parseYoutubeExtractionMarkdown(content);
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
};

type BuildExtractionStructuredPayloadContext = {
  requestId: string;
  projectId: string | null;
  toolKey: string | null;
  artifactId: string | null;
  runtimeNow: () => Date;
  requestInput: Record<string, unknown>;
};

export const buildExtractionStructuredPayload = (
  input: BuildExtractionStructuredPayloadContext,
): Record<string, unknown> => {
  const briefingId = toOptionalString(input.requestInput.briefingId);
  const extractionArtifactId =
    toOptionalString(input.requestInput.extractionArtifactId) ?? input.artifactId;
  const stepDependencyArtifactIds = [
    ...new Set(toStringArray(input.requestInput.stepDependencyArtifactIds)),
  ];
  const briefText =
    toOptionalString(input.requestInput.briefingText)
    ?? toOptionalString(input.requestInput.normalizedText)
    ?? toOptionalString(input.requestInput.prompt)
    ?? '';
  const summary = briefText
    ? briefText.split(/\s+/).slice(0, 60).join(' ')
    : null;

  const fields: Record<string, string | null> = {
    briefing_summary: summary,
    primary_tone: toOptionalString(input.requestInput.tone),
    target_tool: input.toolKey,
  };

  const missingFields = Object.entries(fields)
    .filter(([, value]) => value === null)
    .map(([key]) => key);

  return {
    schemaVersion: 'extraction.v1',
    requestId: input.requestId,
    projectId: input.projectId,
    toolKey: input.toolKey,
    artifactId: input.artifactId,
    briefingId,
    extractionArtifactId,
    stepDependencyArtifactIds,
    fields,
    missingFields,
    meta: {
      charCount: briefText.length,
      wordCount: countWords(briefText),
      generatedAt: input.runtimeNow().toISOString(),
    },
  };
};
