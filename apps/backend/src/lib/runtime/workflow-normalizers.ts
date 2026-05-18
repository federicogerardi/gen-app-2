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
} as const;

type StepMappedToolKey = keyof typeof FINAL_STEP_BY_TOOL;

const isStepMappedToolKey = (value: string | null): value is StepMappedToolKey => {
  return value === 'funnel-pages' || value === 'nextland' || value === 'youtube-lf-script';
};

export const normalizeToolWorkflowKey = (value: string | null | undefined): string | null => {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }

  if (normalized === 'funnel_pages' || normalized === 'hl_funnel' || normalized === 'funnelpages') {
    return 'funnel-pages';
  }

  if (normalized === 'youtube_lf_script') {
    return 'youtube-lf-script';
  }

  if (normalized === 'thank-you' || normalized === 'thankyou') {
    return 'thank_you';
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
