import {
  isToolWorkflowType,
  normalizeToolKeyCandidate,
  resolveToolKeyFromWorkflowType,
} from '@gen-app-2/contracts';

const normalizeValue = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const FINAL_STEP_BY_TOOL = {
  'funnel-pages': 'vsl',
  nextland: 'thank_you',
  'youtube-lf-script': 'outro-structure',
  'angle-generator': 'creative-activation',
  'meta-ads': 'ads-generation',
  'youtube-description': 'youtube-description-generation',
  'geometric': 'unified-report',
  'brief-generator': 'brief-generation',
  'tov-generator': 'tov-generation',
} as const;

type StepMappedToolKey = keyof typeof FINAL_STEP_BY_TOOL;

const isStepMappedToolKey = (value: string | null): value is StepMappedToolKey => {
  return value === 'funnel-pages'
    || value === 'nextland'
    || value === 'youtube-lf-script'
    || value === 'angle-generator'
    || value === 'meta-ads'
    || value === 'youtube-description'
    || value === 'geometric'
    || value === 'brief-generator'
    || value === 'tov-generator';
};

export const normalizeToolWorkflowKey = (value: string | null | undefined): string | null => {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }

  const normalizedToolKey = normalizeToolKeyCandidate(normalized);
  if (normalizedToolKey) {
    return normalizedToolKey;
  }

  if (isToolWorkflowType(normalized)) {
    return resolveToolKeyFromWorkflowType(normalized);
  }

  if (normalized === 'thank-you' || normalized === 'thankyou') {
    return 'thank_you';
  }

  if (
    normalized === 'meta_ads'
    || normalized === 'meta_ads_generator'
    || normalized === 'metaadsgenerator'
  ) {
    return 'meta-ads';
  }

  if (
    normalized === 'youtube_description'
    || normalized === 'youtubedescription'
  ) {
    return 'youtube-description';
  }

  return normalized;
};

export const normalizeStepKey = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }

  if (normalized === 'thank-you' || normalized === 'thankyou') {
    return 'thank_you';
  }

  return normalized;
};

export const resolveToolStepArtifactRole = (
  toolKey: string | null,
  stepKey: string | null,
  explicitArtifactRole?: unknown,
): 'step' | 'final' | null => {
  if (explicitArtifactRole === 'step' || explicitArtifactRole === 'final') {
    return explicitArtifactRole;
  }

  if (!isStepMappedToolKey(toolKey)) {
    return null;
  }

  const normalizedStepKey = normalizeStepKey(stepKey);
  const finalStep = FINAL_STEP_BY_TOOL[toolKey];
  if (normalizedStepKey && normalizedStepKey === finalStep) {
    return 'final';
  }

  return 'step';
};
