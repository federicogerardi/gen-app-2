import type { ServerResponse } from 'node:http';

import { writeJson } from './http-utils';
import type { BackendGenerationRequest } from './request-contract';

export type OwnershipCheck = (
  userId: string,
  projectId: string,
  correlationId?: string,
) => Promise<{ owned: boolean; reason?: 'ownership_forbidden' | 'project_not_found' | string }>;

export type ModelAvailabilityCheck = (
  modelKey: string,
  correlationId?: string,
) => Promise<boolean>;

const readRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const readNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const readArray = (value: unknown): unknown[] | null => {
  return Array.isArray(value) ? value : null;
};

const readYoutubeDescriptionField = (
  source: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): unknown => source[camelKey] ?? source[snakeKey];

const hasValidTimestampPrefix = (value: string): boolean => {
  const candidate = value.trim();
  if (!candidate) {
    return false;
  }

  const tokens = candidate.split(':');
  if (tokens.length < 2 || tokens.length > 3) {
    return false;
  }

  const first = tokens[0]?.trim() ?? '';
  const second = tokens[1]?.trim() ?? '';
  const third = tokens.length === 3 ? (tokens[2]?.trim() ?? '') : null;

  if (!/^\d+$/.test(first) || !/^\d{2}$/.test(second)) {
    return false;
  }

  const seconds = Number(tokens.length === 3 ? third : second);
  const minutes = Number(tokens.length === 3 ? second : first);

  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
    return false;
  }

  if (!Number.isInteger(minutes) || minutes < 0) {
    return false;
  }

  if (tokens.length === 3 && (third === null || !/^\d{2}$/.test(third))) {
    return false;
  }

  return true;
};

const validateYoutubeDescriptionRequest = (
  request: BackendGenerationRequest,
): string | null => {
  if (request.toolKey !== 'youtube-description') {
    return null;
  }

  if (request.outputFormat && request.outputFormat !== 'markdown') {
    return 'youtube_description_requires_markdown_output';
  }

  const extractionPayload = readRecord(request.input.extractionPayload);
  if (!extractionPayload) {
    return 'youtube_description_missing_extraction_payload';
  }

  const requiredStringFields: Array<{ camel: string; snake: string; reason: string }> = [
    { camel: 'videoTitle', snake: 'video_title', reason: 'youtube_description_missing_video_title' },
    { camel: 'topic', snake: 'topic', reason: 'youtube_description_missing_topic' },
    { camel: 'ctaText', snake: 'cta_text', reason: 'youtube_description_missing_cta_text' },
    { camel: 'ctaLink', snake: 'cta_link', reason: 'youtube_description_missing_cta_link' },
    { camel: 'credentialsOrProof', snake: 'credentials_or_proof', reason: 'youtube_description_missing_credentials_or_proof' },
  ];

  for (const field of requiredStringFields) {
    if (!readNonEmptyString(readYoutubeDescriptionField(extractionPayload, field.camel, field.snake))) {
      return field.reason;
    }
  }

  const ctaLink = readNonEmptyString(
    readYoutubeDescriptionField(extractionPayload, 'ctaLink', 'cta_link'),
  );
  if (!ctaLink) {
    return 'youtube_description_missing_cta_link';
  }

  try {
    const parsed = new URL(ctaLink);
    if (!parsed.protocol.startsWith('http')) {
      return 'youtube_description_invalid_cta_link';
    }
  } catch {
    return 'youtube_description_invalid_cta_link';
  }

  const keywords = readArray(
    readYoutubeDescriptionField(extractionPayload, 'keywords', 'keywords'),
  );
  if (!keywords || keywords.length === 0) {
    return 'youtube_description_missing_keywords';
  }

  const hashtags = readArray(
    readYoutubeDescriptionField(extractionPayload, 'hashtags', 'hashtags'),
  );
  if (!hashtags || hashtags.length === 0) {
    return 'youtube_description_missing_hashtags';
  }
  if (hashtags.length > 5) {
    return 'youtube_description_hashtag_limit_exceeded';
  }

  const socialLinks = readArray(
    readYoutubeDescriptionField(extractionPayload, 'socialLinks', 'social_links'),
  );
  if (!socialLinks || socialLinks.length === 0) {
    return 'youtube_description_missing_social_links';
  }

  const chapters = readArray(
    readYoutubeDescriptionField(extractionPayload, 'chaptersWithTimestamps', 'chapters_with_timestamps'),
  );
  if (!chapters || chapters.length === 0) {
    return 'youtube_description_missing_chapters_with_timestamps';
  }

  const hasInvalidChapter = chapters.some((entry) => {
    if (typeof entry !== 'string') {
      return true;
    }

    const timestampToken = entry.trim().split(/\s+/)[0] ?? '';
    return !hasValidTimestampPrefix(timestampToken);
  });
  if (hasInvalidChapter) {
    return 'youtube_description_invalid_chapter_timestamp';
  }

  return null;
};

export const applyOwnershipGuard = async (
  response: ServerResponse,
  request: BackendGenerationRequest,
  correlationId: string,
  checkProjectOwnership?: OwnershipCheck,
): Promise<boolean> => {
  if (!checkProjectOwnership) {
    return true;
  }

  const ownership = await checkProjectOwnership(request.userId, request.projectId, correlationId);
  if (ownership.owned) {
    return true;
  }

  const reason = ownership.reason ?? 'ownership_forbidden';
  const status = reason === 'project_not_found' ? 404 : 403;
  writeJson(response, status, {
    ok: false,
    error: {
      code: status === 404 ? 'not_found' : 'forbidden',
      message: reason,
    },
  });

  return false;
};

export const applyModelAvailabilityGuard = async (
  response: ServerResponse,
  request: BackendGenerationRequest,
  correlationId: string,
  checkModelAvailability?: ModelAvailabilityCheck,
): Promise<{ allowed: boolean; isAvailable: boolean | null }> => {
  if (!checkModelAvailability) {
    return { allowed: true, isAvailable: null };
  }

  const isAvailable = await checkModelAvailability(request.model, correlationId);
  if (isAvailable) {
    return { allowed: true, isAvailable };
  }

  writeJson(response, 422, {
    ok: false,
    error: {
      code: 'unprocessable_entity',
      message: 'model_unavailable',
    },
  });

  return { allowed: false, isAvailable };
};

export const applyRequestContractGuard = (
  response: ServerResponse,
  request: BackendGenerationRequest,
): boolean => {
  const validationReason = validateYoutubeDescriptionRequest(request);
  if (!validationReason) {
    return true;
  }

  writeJson(response, 422, {
    ok: false,
    error: {
      code: 'unprocessable_entity',
      message: validationReason,
    },
  });

  return false;
};
