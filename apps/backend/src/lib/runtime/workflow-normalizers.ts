const normalizeValue = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
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
